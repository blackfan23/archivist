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
 * Attempt to extract series/season context from a file's path ancestry.
 * Shared logic with scanner.service.ts — kept in sync manually.
 *
 * Recognised context markers (searched backwards from the file):
 *   1. Season folder: "Season 1", "Season 01", "S1", "Saison 2"
 *   2. Episode-named folder: any folder containing a SxxExx pattern
 *      e.g. "Babylon.Berlin.S01E03.AN.HDTV.x264-ACED"
 *
 * In both cases the show title is extracted from the folder immediately
 * above the context marker, and the season number is parsed from it.
 */
function extractPathContext(filePath: string): PathContext | undefined {
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
    // Skip the direct parent of the file (i = parts.length - 2) only if it is
    // also the ONLY parent — i.e. the file is directly in the show root.
    // We do want to match episode-named folders that sit between the show
    // folder and the file.
    const episodeFolderMatch = part.match(/[Ss](\d{1,2})[\s.]*[Ee](\d{1,3})/i);
    if (episodeFolderMatch) {
      const season = parseInt(episodeFolderMatch[1], 10);
      // The show folder is the parent of this episode folder
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

/** Extract a clean show title from a raw folder name, stripping year suffixes and normalizing characters. */
function extractShowTitle(folder: string | undefined): string | undefined {
  if (!folder) return undefined;
  // Strip (Year) and then normalize characters (dots/underscores to spaces)
  const raw = folder.replace(/\s*\(((?:19|20)\d{2})\)\s*$/, '').trim();
  return raw.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Extract a 4-digit year from a raw folder name like "Show Name (2004)". */
function extractYear(folder: string | undefined): string | undefined {
  if (!folder) return undefined;
  const m = folder.match(/\(((?:19|20)\d{2})\)/);
  return m ? m[1] : undefined;
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
