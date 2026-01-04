import { BrowserWindow } from 'electron';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { isSupportedMediaFile, MediaFile, ScanProgress } from '../models';
import { probeFile } from './ffprobe.service';

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

export function requestCancelScan(): void {
  cancelRequested = true;
}

async function findMediaFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  
  async function walkDir(dir: string): Promise<void> {
    if (cancelRequested) return;
    
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (cancelRequested) return;
        
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip hidden directories
          if (!entry.name.startsWith('.')) {
            await walkDir(fullPath);
          }
        } else if (entry.isFile() && isSupportedMediaFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      // Skip directories we can't read (permission issues, etc.)
      console.warn(`Cannot read directory ${dir}:`, err);
    }
  }
  
  await walkDir(directory);
  return files;
}

export async function scanDirectory(
  directory: string,
  options: ScanOptions = {}
): Promise<MediaFile[]> {
  const { maxConcurrency = 4, window, existingFiles } = options;
  cancelRequested = false;
  
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
      window.webContents.send('scan-progress', progress);
    }
  };
  
  // First, find all media files
  const filePaths = await findMediaFiles(directory);
  progress.totalCount = filePaths.length;
  emitProgress();
  
  if (cancelRequested) {
    progress.status = 'cancelled';
    progress.completedAt = Date.now();
    emitProgress();
    return [];
  }
  
  const results: MediaFile[] = [];
  
  // Track which existing files we've seen (to identify deleted files)
  const seenPaths = new Set<string>();
  
  // Process files with concurrency limit
  const queue = [...filePaths];
  const processing: Promise<void>[] = [];
  
  async function processNext(): Promise<void> {
    while (queue.length > 0 && !cancelRequested) {
      const filePath = queue.shift()!;
      progress.currentFile = filePath;
      seenPaths.add(filePath);
      
      try {
        // Check if we can skip this file (unchanged since last scan)
        const existingInfo = existingFiles?.get(filePath);
        
        if (existingInfo) {
          // Get file modification time
          const fileStat = await stat(filePath);
          const mtime = fileStat.mtimeMs;
          
          // If file hasn't been modified since last scan, reuse existing data
          if (mtime <= existingInfo.scannedAt) {
            results.push(existingInfo.mediaFile);
            progress.skippedCount = (progress.skippedCount ?? 0) + 1;
            progress.processedCount++;
            emitProgress();
            continue;
          }
        }
        
        // File is new or modified, need to probe it
        const mediaFile = await probeFile(filePath);
        results.push(mediaFile);
      } catch (err) {
        progress.errorCount++;
        progress.errors?.push({
          path: filePath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      
      progress.processedCount++;
      emitProgress();
    }
  }
  
  // Start concurrent workers
  for (let i = 0; i < maxConcurrency; i++) {
    processing.push(processNext());
  }
  
  await Promise.all(processing);
  
  // Finalize progress
  if (cancelRequested) {
    progress.status = 'cancelled';
  } else if (progress.errorCount > 0 && results.length === 0) {
    progress.status = 'error';
    progress.errorMessage = `All ${progress.errorCount} files failed to scan`;
  } else {
    progress.status = 'completed';
  }
  
  progress.completedAt = Date.now();
  progress.currentFile = undefined;
  emitProgress();
  
  return results;
}
