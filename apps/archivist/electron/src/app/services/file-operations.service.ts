import { access, constants, mkdir, rename, rmdir, unlink } from 'fs/promises';
import { basename, dirname, join } from 'path';
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
