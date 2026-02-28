import {
  access,
  constants,
  mkdir,
  readdir,
  rename,
  rm,
  rmdir,
} from 'fs/promises';
import { basename, dirname, extname, join, normalize } from 'path';
import { BatchResult } from '../models';

export async function renameFile(
  oldPath: string,
  newPath: string,
): Promise<void> {
  // Ensure target directory exists
  const targetDir = dirname(newPath);
  await mkdir(targetDir, { recursive: true });

  // Check if source exists
  await access(oldPath, constants.F_OK);

  // Perform rename
  await rename(oldPath, newPath);
}

// Supported subtitle file extensions
const SUBTITLE_EXTENSIONS = ['.srt', '.sub', '.ass', '.ssa', '.vtt', '.idx'];

// Common media extensions to skip during cleanup (to avoid circular deps with archivist-core)
const MEDIA_EXTENSIONS = [
  '.mkv',
  '.mp4',
  '.avi',
  '.mov',
  '.wmv',
  '.flv',
  '.webm',
  '.m4v',
  '.mpg',
  '.mpeg',
  '.ts',
  '.m2ts',
  '.vob',
];

/**
 * Find ALL subtitle files in the same directory as the media file.
 * Returns all subtitle files regardless of their base name.
 */
export async function findAllSubtitlesInFolder(
  mediaPath: string,
): Promise<string[]> {
  const dir = dirname(mediaPath);
  const ext = extname(mediaPath);
  const baseName = basename(mediaPath, ext).toLowerCase();

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const subtitles: string[] = [];

  for (const entry of entries) {
    const entryExt = extname(entry).toLowerCase();
    const entryBase = basename(entry, entryExt).toLowerCase();

    // Selective match: Subtitle must start with the same base name as the movie
    // e.g. "Movie.mkv" matches "Movie.srt", "Movie.en.srt", but NOT "Other.srt"
    if (
      SUBTITLE_EXTENSIONS.includes(entryExt) &&
      entryBase.startsWith(baseName)
    ) {
      subtitles.push(join(dir, entry));
    }
  }

  return subtitles;
}

/**
 * Extract language/track suffix from a subtitle filename.
 * e.g., "Movie.en.srt" -> ".en", "Movie.forced.en.srt" -> ".forced.en"
 * Returns empty string if no suffix detected.
 */
function extractSubtitleSuffix(subtitlePath: string): string {
  const ext = extname(subtitlePath);
  const baseName = basename(subtitlePath, ext);

  // Common language codes and modifiers
  const parts = baseName.split('.');
  if (parts.length <= 1) return '';

  // Take the last parts that look like language codes or modifiers
  const suffixParts: string[] = [];
  for (let i = parts.length - 1; i >= 1; i--) {
    const part = parts[i].toLowerCase();
    // Check if it's a language code (2-3 chars) or common modifier
    if (
      part.length <= 3 ||
      ['forced', 'sdh', 'cc', 'default', 'hi'].includes(part)
    ) {
      suffixParts.unshift(parts[i]);
    } else {
      break;
    }
  }

  return suffixParts.length > 0 ? '.' + suffixParts.join('.') : '';
}

/**
 * Rename a media file and ALL subtitle files in the same folder.
 * All subtitles are renamed to match the new media filename,
 * preserving their language/track suffixes and extensions.
 */
export async function renameFileWithSubtitles(
  oldPath: string,
  newPath: string,
): Promise<string[]> {
  const newExt = extname(newPath);
  const newBaseName = basename(newPath, newExt);
  const newDir = dirname(newPath);

  // Find ALL subtitle files in the folder before renaming
  const subtitles = await findAllSubtitlesInFolder(oldPath);
  const renamedSubtitles: string[] = [];

  // Rename the main media file
  await renameFile(oldPath, newPath);

  // Track used names to avoid conflicts
  const usedNames = new Set<string>();

  // Rename each subtitle file to match the new media filename
  for (const subPath of subtitles) {
    const subExt = extname(subPath);
    const suffix = extractSubtitleSuffix(subPath);

    // Build new subtitle name: newBaseName + suffix + extension
    let newSubName = newBaseName + suffix + subExt;

    // Handle potential name conflicts by adding an index
    if (usedNames.has(newSubName.toLowerCase())) {
      let index = 2;
      while (
        usedNames.has(`${newBaseName}${suffix}.${index}${subExt}`.toLowerCase())
      ) {
        index++;
      }
      newSubName = `${newBaseName}${suffix}.${index}${subExt}`;
    }
    usedNames.add(newSubName.toLowerCase());

    const newSubPath = join(newDir, newSubName);

    try {
      await renameFile(subPath, newSubPath);
      renamedSubtitles.push(newSubPath);
    } catch {
      // Continue with other subtitles if one fails
    }
  }

  return renamedSubtitles;
}

export async function moveFile(
  sourcePath: string,
  destDir: string,
): Promise<string> {
  // Ensure destination directory exists
  await mkdir(destDir, { recursive: true });

  // Check if source exists
  await access(sourcePath, constants.F_OK);

  // Build destination path
  const filename = basename(sourcePath);
  const destPath = join(destDir, filename);

  // Perform move
  await rename(sourcePath, destPath);

  return destPath;
}

export async function batchRename(
  files: Array<{ oldPath: string; newPath: string }>,
): Promise<BatchResult> {
  const result: BatchResult = {
    successCount: 0,
    failedCount: 0,
    errors: [],
  };

  for (const { oldPath, newPath } of files) {
    try {
      await renameFile(oldPath, newPath);
      result.successCount++;
    } catch (err) {
      result.failedCount++;
      result.errors.push({
        path: oldPath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

export async function batchMove(
  sourcePaths: string[],
  destDir: string,
): Promise<BatchResult> {
  const result: BatchResult = {
    successCount: 0,
    failedCount: 0,
    errors: [],
  };

  // Ensure destination directory exists once
  await mkdir(destDir, { recursive: true });

  for (const sourcePath of sourcePaths) {
    try {
      await moveFile(sourcePath, destDir);
      result.successCount++;
    } catch (err) {
      result.failedCount++;
      result.errors.push({
        path: sourcePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

export async function deleteFile(filePath: string): Promise<void> {
  // Check if file exists
  await access(filePath, constants.F_OK);

  // Delete the file or directory
  await rm(filePath, { recursive: true, force: true });
}

export async function deleteFolder(folderPath: string): Promise<void> {
  // Check if folder exists
  await access(folderPath, constants.F_OK);

  // Delete the folder (only works if empty)
  await rmdir(folderPath);
}

export interface DeleteResult extends BatchResult {
  foldersDeleted: number;
  folderErrors: Array<{ path: string; error: string }>;
}

export async function batchDelete(
  filePaths: string[],
  deleteParentFolders = false,
): Promise<DeleteResult> {
  const result: DeleteResult = {
    successCount: 0,
    failedCount: 0,
    errors: [],
    foldersDeleted: 0,
    folderErrors: [],
  };

  console.log(
    `[FileOperations] Starting batch delete of ${filePaths.length} items`,
  );

  // Track parent folders if we need to delete them
  const parentFolders = new Set<string>();

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    try {
      if (i % 10 === 0) {
        console.log(
          `[FileOperations] Deleting item ${i + 1}/${filePaths.length}: ${filePath}`,
        );
      }
      await deleteFile(filePath);
      result.successCount++;

      if (deleteParentFolders) {
        parentFolders.add(dirname(filePath));
      }
    } catch (err) {
      result.failedCount++;
      result.errors.push({
        path: filePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Delete parent folders if requested
  if (deleteParentFolders) {
    for (const folderPath of parentFolders) {
      try {
        await deleteFolder(folderPath);
        result.foldersDeleted++;
      } catch (err) {
        // Folder might not be empty or other error - this is expected in many cases
        result.folderErrors.push({
          path: folderPath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  console.log(
    `[FileOperations] Batch delete completed. Success: ${result.successCount}, Failed: ${result.failedCount}`,
  );
  return result;
}

export async function renameFolder(
  oldPath: string,
  newPath: string,
): Promise<void> {
  // Check if source folder exists
  await access(oldPath, constants.F_OK);

  // Ensure target directory exists (parent of new path)
  const targetDir = dirname(newPath);
  await mkdir(targetDir, { recursive: true });

  // Perform rename
  await rename(oldPath, newPath);
}

/**
 * Move all files from source directory to target directory.
 */
export async function moveRemainingFiles(
  sourceDir: string,
  targetDir: string,
): Promise<void> {
  try {
    const entries = await readdir(sourceDir, { withFileTypes: true });

    // Ensure target exists
    await mkdir(targetDir, { recursive: true });

    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (MEDIA_EXTENSIONS.includes(ext)) {
          console.log(
            `[FileOperations] Skipping media file during cleanup: ${entry.name}`,
          );
          continue;
        }

        const sourcePath = join(sourceDir, entry.name);
        const targetPath = join(targetDir, entry.name);

        try {
          // Check if target already exists to avoid overwriting without warning
          await access(targetPath, constants.F_OK);
          // If it exists, skip or handle (for now skip)
        } catch {
          // Doesn't exist, safe to rename
          await rename(sourcePath, targetPath);
        }
      }
    }
  } catch (err) {
    console.error(
      `[FileOperations] Failed to move remaining files from ${sourceDir}:`,
      err,
    );
  }
}

/**
 * Attempt to delete a folder if it is empty and not the root path.
 */
export async function cleanupEmptyFolder(
  folderPath: string,
  rootPath?: string,
): Promise<void> {
  try {
    // Normalize paths for comparison
    const normFolder = normalize(folderPath);
    const normRoot = rootPath ? normalize(rootPath) : null;

    if (normRoot && normFolder === normRoot) {
      return; // Never delete root
    }

    const entries = await readdir(normFolder);
    if (entries.length === 0) {
      await rmdir(normFolder);
      console.log(`[FileOperations] Cleaned up empty folder: ${normFolder}`);
    }
  } catch (err) {
    // Silently fail if folder not empty or other issues
  }
}
