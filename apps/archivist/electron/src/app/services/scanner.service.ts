import {
  IPC_CHANNELS,
  isSupportedMediaFile,
  MediaFile,
  PathContext,
  ScanProgress,
} from '@medularity/archivist-core';
import { app, BrowserWindow } from 'electron';
import { fdir } from 'fdir';
import { stat } from 'fs/promises';
import { arch, cpus, platform } from 'os';
import { join } from 'path';
import { Worker } from 'worker_threads';

interface ExistingFileInfo {
  scannedAt: number;
  mediaFile: MediaFile;
}

interface ScanOptions {
  maxConcurrency?: number;
  window?: BrowserWindow;
  existingFiles?: Map<string, ExistingFileInfo>;
}

let cancelRequested = false;
const activeWorkers: Set<Worker> = new Set();

export function requestCancelScan(): void {
  cancelRequested = true;
  activeWorkers.forEach((worker) => worker.terminate());
  activeWorkers.clear();
}

/**
 * Gets the correct path to the ffprobe binary.
 * (Duplicated from ffprobe.service to avoid circular refs and for worker passing)
 */
function getFFprobePath(): string {
  if (app.isPackaged) {
    const ffprobeBinary = platform() === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    const binPath = join(
      'node_modules',
      'ffprobe-static',
      'bin',
      platform(),
      arch(),
      ffprobeBinary,
    );
    return join(process.resourcesPath, 'app.asar.unpacked', binPath);
  }
  return require('ffprobe-static').path;
}

/**
 * Attempt to extract series/season context from a file's path ancestry.
 *
 * Recognised context markers (searched backwards from the file):
 *   1. Season folder: "Season 1", "Season 01", "S1", "Saison 2"
 *   2. Episode-named folder: any folder containing a SxxExx pattern
 *      e.g. "Babylon.Berlin.S01E03.AN.HDTV.x264-ACED"
 *
 * In both cases the show title is extracted from the folder immediately
 * above the context marker, and the season number is parsed from it.
 */
function extractPathContext(
  filePath: string,
  _rootDir: string,
): PathContext | undefined {
  const parts = filePath.split(/[\/\\]/);

  const maxDepth = Math.max(0, parts.length - 7);

  for (let i = parts.length - 2; i >= maxDepth; i--) {
    const part = parts[i];
    if (!part) continue;

    // --- Pattern 1: explicit "Season X" / "Saison X" / "S X" folder ---
    const seasonMatch = part.match(
      /^(?:[Ss]eason|[Ss]aison|[Ss])\s*(\d{1,2})$/,
    );
    if (seasonMatch) {
      const season = parseInt(seasonMatch[1], 10);
      const showTitle = extractShowTitle(parts[i - 1]);
      const year = extractYear(parts[i - 1]);
      const context: PathContext = { season };
      if (showTitle) context.showTitle = showTitle;
      if (year) context.year = year;
      return context;
    }

    // --- Pattern 2: episode-named folder (e.g. "Show.S01E03.HDTV.x264") ---
    const episodeFolderMatch = part.match(/[Ss](\d{1,2})[\s.]*[Ee](\d{1,3})/i);
    if (episodeFolderMatch) {
      const season = parseInt(episodeFolderMatch[1], 10);
      const showTitle = extractShowTitle(parts[i - 1]);
      const year = extractYear(parts[i - 1]);
      const context: PathContext = { season };
      if (showTitle) context.showTitle = showTitle;
      if (year) context.year = year;
      return context;
    }
  }

  return undefined;
}

/** Extract a clean show title from a raw folder name, stripping year suffixes and normalizing. */
function extractShowTitle(folder: string | undefined): string | undefined {
  if (!folder) return undefined;
  const raw = folder.replace(/\s*\(((?:19|20)\d{2})\)\s*$/, '').trim();
  return raw.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Extract a 4-digit year from a raw folder name like "Show Name (2004)". */
function extractYear(folder: string | undefined): string | undefined {
  if (!folder) return undefined;
  const m = folder.match(/\(((?:19|20)\d{2})\)/);
  return m ? m[1] : undefined;
}

interface ScanResult {
  filePaths: string[];
  pathContextMap: Map<string, PathContext>;
}

async function findMediaFiles(directory: string): Promise<ScanResult> {
  const crawler = new fdir()
    .withFullPaths()
    .exclude((dirName) => dirName.startsWith('.'))
    .filter((path) => isSupportedMediaFile(path))
    .crawl(directory);

  const filePaths = (await crawler.withPromise()) as string[];
  const pathContextMap = new Map<string, PathContext>();

  for (const filePath of filePaths) {
    if (cancelRequested) break;
    const ctx = extractPathContext(filePath, directory);
    if (ctx) {
      pathContextMap.set(filePath, ctx);
    }
  }

  return { filePaths, pathContextMap };
}

export async function scanDirectory(
  directory: string,
  options: ScanOptions = {},
): Promise<MediaFile[]> {
  const {
    maxConcurrency = Math.max(1, cpus().length - 1),
    window,
    existingFiles,
  } = options;
  cancelRequested = false;
  activeWorkers.clear();

  const ffprobePath = getFFprobePath();
  const workerPath = join(__dirname, 'workers', 'scanner.worker.cjs');

  const progress: ScanProgress = {
    status: 'scanning',
    processedCount: 0,
    errorCount: 0,
    skippedCount: 0,
    errors: [],
    startedAt: Date.now(),
  };

  const emitProgress = (): void => {
    if (window && !window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, progress);
    }
  };

  const { filePaths, pathContextMap } = await findMediaFiles(directory);
  progress.totalCount = filePaths.length;
  emitProgress();

  if (cancelRequested || filePaths.length === 0) {
    progress.status = cancelRequested ? 'cancelled' : 'completed';
    progress.completedAt = Date.now();
    emitProgress();
    return [];
  }

  const results: MediaFile[] = [];
  const queue = [...filePaths];

  return new Promise((resolve) => {
    let activeTasks = 0;

    const finalizeAndResolve = () => {
      progress.status = cancelRequested ? 'cancelled' : 'completed';
      if (progress.errorCount > 0 && results.length === 0 && !cancelRequested) {
        progress.status = 'error';
        progress.errorMessage = `All ${progress.errorCount} files failed to scan`;
      }
      progress.completedAt = Date.now();
      progress.currentFile = undefined;
      emitProgress();
      resolve(results);
    };

    const BATCH_SIZE = 10;

    const spawnWorker = () => {
      if (
        queue.length === 0 ||
        cancelRequested ||
        activeTasks >= maxConcurrency
      ) {
        if (cancelRequested && activeTasks === 0) finalizeAndResolve();
        return;
      }

      const worker = new Worker(workerPath);
      activeWorkers.add(worker);
      activeTasks++;

      const processBatch = async () => {
        if (queue.length === 0 || cancelRequested) {
          worker.terminate();
          activeWorkers.delete(worker);
          activeTasks--;
          if (activeTasks === 0) {
            finalizeAndResolve();
          }
          return;
        }

        const batch: string[] = [];
        while (batch.length < BATCH_SIZE && queue.length > 0) {
          const filePath = queue.shift();
          if (filePath) batch.push(filePath);
        }

        if (batch.length === 0) return;

        progress.currentFile = batch[0]; // Just show the first one in UI

        const filesToProbe: string[] = [];

        for (const filePath of batch) {
          const existingInfo = existingFiles?.get(filePath);
          if (existingInfo) {
            try {
              const fileStat = await stat(filePath);
              if (fileStat.mtimeMs <= existingInfo.scannedAt) {
                results.push(existingInfo.mediaFile);
                progress.skippedCount = (progress.skippedCount ?? 0) + 1;
                progress.processedCount++;
              } else {
                filesToProbe.push(filePath);
              }
            } catch {
              filesToProbe.push(filePath);
            }
          } else {
            filesToProbe.push(filePath);
          }
        }

        if (filesToProbe.length > 0) {
          worker.postMessage({ batch: filesToProbe, ffprobePath });
        } else {
          // All were skipped, handle next immediately
          emitProgress();
          processBatch();
        }
      };

      worker.on('message', (msg) => {
        if (cancelRequested) return;

        if (msg.results && Array.isArray(msg.results)) {
          for (const mediaFile of msg.results) {
            const ctx = pathContextMap.get(mediaFile.path);
            if (ctx) {
              mediaFile.pathContext = ctx;
            }
            results.push(mediaFile);
            progress.processedCount++;
          }
        }

        if (msg.errors && Array.isArray(msg.errors)) {
          for (const err of msg.errors) {
            progress.errorCount++;
            progress.errors?.push({ path: err.path, error: err.error });
            progress.processedCount++;
          }
        }

        emitProgress();
        processBatch();
      });

      worker.on('error', (err) => {
        if (!cancelRequested) {
          console.error('Worker error:', err);
          progress.errorCount++;
        }
        activeTasks--;
        activeWorkers.delete(worker);
        if (activeTasks === 0) finalizeAndResolve();
      });

      worker.on('exit', (code) => {
        activeWorkers.delete(worker);
      });

      processBatch();
    };

    // Start pool
    const numWorkers = Math.min(
      maxConcurrency,
      Math.ceil(queue.length / BATCH_SIZE),
    );
    for (let i = 0; i < numWorkers; i++) {
      spawnWorker();
    }
  });
}
