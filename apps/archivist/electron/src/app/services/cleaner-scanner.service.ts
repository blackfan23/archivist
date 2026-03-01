import { CleanerResultItem } from '@medularity/archivist-core';
import { readdir, stat } from 'fs/promises';
import { Dirent } from 'node:fs';
import { basename, extname, join } from 'path';

const SMALL_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
const SUBTITLE_EXTENSIONS = ['.srt', '.sub', '.vtt', '.ass', '.ssa', '.idx'];

let cancelRequested = false;

export function requestCancelCleanerScan(): void {
  cancelRequested = true;
}

/**
 * Recursively crawls directory to find empty folders and small files.
 */
async function crawl(dir: string, results: CleanerResultItem[]): Promise<void> {
  if (cancelRequested) return;

  let entries: Dirent<string>[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`[CleanerScanner] Failed to read directory: ${dir}`, err);
    throw err;
  }

  // Filter out hidden files and system files (e.g. .DS_Store, .archivist)
  const visibleEntries = entries.filter((e) => !e.name.startsWith('.'));

  if (visibleEntries.length === 0) {
    results.push({
      type: 'folder',
      path: dir,
    });
    // Even if it's empty, we stop here for this branch
    return;
  }

  const subdirPromises: Promise<void>[] = [];

  for (const entry of visibleEntries) {
    if (cancelRequested) break;

    const fullPath = join(dir, entry.name);

    try {
      let isDir = entry.isDirectory();
      let isFile = entry.isFile();

      if (entry.isSymbolicLink()) {
        const s = await stat(fullPath);
        isDir = s.isDirectory();
        isFile = s.isFile();
      }

      if (isDir) {
        subdirPromises.push(crawl(fullPath, results));
      } else if (isFile) {
        const ext = extname(entry.name).toLowerCase();

        // Skip hidden files again just in case (e.g. if we didn't filter early enough)
        if (entry.name.startsWith('.')) continue;

        // Check for small files or 0-byte files
        const fileStat = await stat(fullPath);
        const fileNameLower = entry.name.toLowerCase();
        const pathLower = fullPath.toLowerCase();

        const isZeroByte = fileStat.size === 0;
        const isSmallNonSubtitle =
          fileStat.size < SMALL_FILE_THRESHOLD &&
          !SUBTITLE_EXTENSIONS.includes(ext);

        const isSample =
          (fileNameLower.includes('sample') || pathLower.includes('sample')) &&
          fileStat.size > 0 &&
          fileStat.size < 100 * 1024 * 1024; // 100MB

        // Success Criteria: 0-byte files are captured regardless of extension.
        // Small files (<10MB) are only captured if not a subtitle.
        // Sample files are captured based on name/path and size.
        if (isZeroByte || isSmallNonSubtitle || isSample) {
          results.push({
            type: 'file',
            path: fullPath,
            filename: basename(fullPath),
            sizeBytes: fileStat.size,
            isSample: isSample || undefined,
          });
        }
      }
    } catch (err) {
      console.warn(
        `[CleanerScanner] Failed to process entry: ${fullPath}`,
        err,
      );
    }
  }

  await Promise.all(subdirPromises);
}

/**
 * Scans a directory for empty folders and small non-subtitle files.
 */
export async function scanForCleanup(
  directoryPath: string,
): Promise<CleanerResultItem[]> {
  const results: CleanerResultItem[] = [];
  cancelRequested = false;

  console.log(`[CleanerScanner] Starting cleanup scan of: ${directoryPath}`);
  const startTime = Date.now();

  await crawl(directoryPath, results);

  console.log(
    `[CleanerScanner] Scan completed in ${Date.now() - startTime}ms. Found ${results.length} items.`,
  );
  return results;
}
