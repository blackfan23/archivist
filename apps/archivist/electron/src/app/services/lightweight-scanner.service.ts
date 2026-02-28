import {
  isSupportedMediaFile,
  LightweightFile,
  PathContext,
} from '@medularity/archivist-core';
import { readdir, stat } from 'fs/promises';
import { Dirent } from 'node:fs';
import { basename, extname, join } from 'path';

let cancelRequested = false;

export function requestCancelLightweightScan(): void {
  cancelRequested = true;
}

/**
 * Attempt to extract series/season context from a file's parent and grandparent
 * folder names. Shared logic with scanner.service.ts — kept in sync manually.
 *
 * Recognized patterns:
 *   Parent: "Season 1", "Season 01", "S1", "Saison 2"
 *   Grandparent: "Show Name (2004)", "Show Name"
 */
function extractPathContext(filePath: string): PathContext | undefined {
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

/**
 * Recursively crawls `directory` collecting supported media files using
 * `readdir` with `{ withFileTypes: true }` to avoid redundant stat calls.
 * Falls back to `stat` for size/mtime when Dirent does not expose them
 * (Node 18 introduced `size` and `mtimeMs` on Dirent — we stat defensively).
 */
async function crawl(dir: string, results: LightweightFile[]): Promise<void> {
  if (cancelRequested) return;

  let entries: Dirent<string>[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`[Scanner] Failed to read directory: ${dir}`, err);
    throw err;
  }

  const subdirPromises: Promise<void>[] = [];

  for (const entry of entries) {
    if (cancelRequested) break;

    // Skip hidden files and directories (start with '.')
    if (entry.name.startsWith('.')) continue;

    const fullPath = join(dir, entry.name);

    try {
      // For symlinks, we need stat to see what they point to
      let isDir = entry.isDirectory();
      let isFile = entry.isFile();

      if (entry.isSymbolicLink()) {
        const s = await stat(fullPath);
        isDir = s.isDirectory();
        isFile = s.isFile();
      }

      if (isDir) {
        subdirPromises.push(crawl(fullPath, results));
      } else if (isFile && isSupportedMediaFile(entry.name)) {
        const fileStat = await stat(fullPath);
        const pathContext = extractPathContext(fullPath); // Extract context from the file path itself

        const file: LightweightFile = {
          path: fullPath,
          filename: basename(fullPath),
          extension: extname(entry.name).toLowerCase(),
          sizeBytes: fileStat.size,
          modifiedAt: fileStat.mtimeMs,
        };

        if (pathContext) {
          file.pathContext = pathContext;
        }

        results.push(file);
      }
    } catch (err) {
      console.warn(`[Scanner] Failed to process entry: ${fullPath}`, err);
    }
  }

  // Process subdirectories concurrently (bounded implicitly by the OS)
  await Promise.all(subdirPromises);
}

/**
 * Performs a fast, filesystem-only scan of `directory`.
 *
 * Unlike the full `scanDirectory` (which spawns ffprobe workers), this function:
 *  - Uses `readdir` with `{ withFileTypes: true }` — no separate stat for type check
 *  - Collects only path, filename, extension, size, and mtime
 *  - Extracts `pathContext` from folder names (Season / Show hierarchy)
 *  - Spawns **no child processes**
 *
 * Intended exclusively for AI mode, where the analysis pipeline only needs
 * filenames to query TMDB and generate rename suggestions.
 *
 * @param directory - Absolute path to the root folder to scan
 * @param onProgress - Optional callback invoked after each file is added (receives running total)
 * @returns Array of LightweightFile descriptors
 */
export async function scanDirectoryLightweight(
  directoryPath: string,
): Promise<LightweightFile[]> {
  const results: LightweightFile[] = [];
  cancelRequested = false;

  console.log(`[Scanner] Starting lightweight scan of: ${directoryPath}`);
  const startTime = Date.now();

  await crawl(directoryPath, results);

  console.log(
    `[Scanner] Scan completed in ${Date.now() - startTime}ms. Found ${results.length} files.`,
  );
  return results;
}
