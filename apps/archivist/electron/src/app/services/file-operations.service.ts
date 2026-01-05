import { access, constants, mkdir, readdir, rename, rmdir, unlink } from 'fs/promises';
import { basename, dirname, extname, join } from 'path';
import { BatchResult } from '../models';

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
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

/**
 * Find subtitle files associated with a media file.
 * Matches subtitles that share the base filename, including language suffixes.
 * e.g., "Movie.srt", "Movie.en.srt", "Movie.forced.en.srt"
 */
export async function findAssociatedSubtitles(mediaPath: string): Promise<string[]> {
  const dir = dirname(mediaPath);
  const mediaExt = extname(mediaPath);
  const baseName = basename(mediaPath, mediaExt);
  
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  
  const subtitles: string[] = [];
  
  for (const entry of entries) {
    const entryExt = extname(entry).toLowerCase();
    if (SUBTITLE_EXTENSIONS.includes(entryExt)) {
      // Check if subtitle starts with the media base name
      const entryBase = entry.slice(0, -entryExt.length);
      if (entryBase === baseName || entryBase.startsWith(baseName + '.')) {
        subtitles.push(join(dir, entry));
      }
    }
  }
  
  return subtitles;
}

/**
 * Rename a media file and its associated subtitle files.
 * Returns the list of renamed subtitle paths.
 */
export async function renameFileWithSubtitles(
  oldPath: string, 
  newPath: string
): Promise<string[]> {
  const oldExt = extname(oldPath);
  const newExt = extname(newPath);
  const oldBaseName = basename(oldPath, oldExt);
  const newBaseName = basename(newPath, newExt);
  const newDir = dirname(newPath);
  
  // Find subtitle files before renaming
  const subtitles = await findAssociatedSubtitles(oldPath);
  const renamedSubtitles: string[] = [];
  
  // Rename the main media file
  await renameFile(oldPath, newPath);
  
  // Rename each associated subtitle file
  for (const subPath of subtitles) {
    const subExt = extname(subPath);
    const subBaseName = basename(subPath, subExt);
    
    // Preserve language/type suffixes like ".en" or ".forced"
    const suffix = subBaseName.slice(oldBaseName.length);
    const newSubName = newBaseName + suffix + subExt;
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

export async function moveFile(sourcePath: string, destDir: string): Promise<string> {
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
  files: Array<{ oldPath: string; newPath: string }>
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
  destDir: string
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
  
  // Delete the file
  await unlink(filePath);
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
  deleteParentFolders = false
): Promise<DeleteResult> {
  const result: DeleteResult = {
    successCount: 0,
    failedCount: 0,
    errors: [],
    foldersDeleted: 0,
    folderErrors: [],
  };
  
  // Track parent folders if we need to delete them
  const parentFolders = new Set<string>();
  
  for (const filePath of filePaths) {
    try {
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
  
  return result;
}

export async function renameFolder(oldPath: string, newPath: string): Promise<void> {
  // Check if source folder exists
  await access(oldPath, constants.F_OK);
  
  // Ensure target directory exists (parent of new path)
  const targetDir = dirname(newPath);
  await mkdir(targetDir, { recursive: true });
  
  // Perform rename
  await rename(oldPath, newPath);
}
