import * as fs from 'fs/promises';
import * as path from 'path';
import { DatabaseService } from './database.service';

const DB_FILENAME = 'optimize.archivist';

export const OptimizationStateService = {
  /**
   * Update the state for a specific file in SQLite
   */
  async updateFileState(
    rootPath: string,
    filePath: string,
    isClean: boolean,
    lastModified: number,
    suggestedName?: string,
    analysisResult?: string,
  ): Promise<void> {
    DatabaseService.updateAIState(filePath, {
      isClean,
      suggestedName,
      analysisResult,
    });
  },

  /**
   * Check if a file is known to be clean and hasn't changed
   */
  async isFileClean(
    rootPath: string,
    filePath: string,
    currentModifiedTime: number,
  ): Promise<boolean> {
    const aiState = DatabaseService.getFileAIState(filePath);
    if (!aiState) return false;

    // In a consolidated SQLite setup, we rely on the file's presence in media_files
    // where its modifiedAt is already stored and checked during scan.
    // If it's in the DB and marked clean, it's clean.
    return aiState.isClean;
  },

  /**
   * Recursively find and delete all legacy optimize.archivist files
   */
  async resetAll(rootPath: string): Promise<number> {
    let deletedCount = 0;

    const findAndDelete = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await findAndDelete(fullPath);
        } else if (entry.name === DB_FILENAME) {
          try {
            await fs.unlink(fullPath);
            deletedCount++;
          } catch (error) {
            console.error(
              `Failed to delete legacy sidecar ${fullPath}:`,
              error,
            );
          }
        }
      }
    };

    try {
      await findAndDelete(rootPath);
    } catch (error) {
      console.error(`Error during sidecar reset in ${rootPath}:`, error);
    }

    return deletedCount;
  },
};
