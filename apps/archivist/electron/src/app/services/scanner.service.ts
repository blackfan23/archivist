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
 * Attempt to extract series/season context from a file's parent and grandparent
 * folder names. Returns a PathContext if any series/season info is found.
 *
 * Recognized patterns:
 *   Parent: "Season 1", "Season 01", "S1", "Saison 2"
 *   Grandparent: "Show Name (2004)", "Show Name"
 */
function extractPathContext(
  filePath: string,
  rootDir: string,
): PathContext | undefined {
  const parts = filePath.split(/[\/\\]/);

  // Iterate backwards to find a "Season X" folder
  // Check up to 5 levels above the filename
  let seasonIndex = -1;
  let seasonMatch: RegExpMatchArray | null = null;
  const maxDepth = Math.max(0, parts.length - 7);

  for (let i = parts.length - 2; i >= maxDepth; i--) {
    const part = parts[i];
    if (!part) continue;

    seasonMatch = part.match(/^(?:[Ss]eason|[Ss]aison|[Ss])\s*(\d{1,2})$/);
    if (seasonMatch) {
      seasonIndex = i;
      break;
    }
  }

  if (seasonIndex === -1 || !seasonMatch) return undefined;

  const season = parseInt(seasonMatch[1], 10);
  const grandparent = parts[seasonIndex - 1]; // Folder containing "Season X"

  let showTitle: string | undefined;
  let year: string | undefined;

  if (grandparent) {
    const showYearMatch = grandparent.match(
      /^(.+?)\s*\(((?:19|20)\d{2})\)\s*$/,
    );
    if (showYearMatch) {
      showTitle = showYearMatch[1].trim();
      year = showYearMatch[2];
    } else {
      showTitle = grandparent.trim();
    }
  }

  const context: PathContext = { season };
  if (showTitle) context.showTitle = showTitle;
  if (year) context.year = year;
  return context;
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
