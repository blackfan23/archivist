import { IPC_CHANNELS } from '@medularity/archivist-core';
import { ipcMain } from 'electron';
import { OmdbService } from './omdb.service';
import { getSettings } from './storage.service';
import { TmdbService } from './tmdb.service';

export interface KeyValidationResult {
  tmdb: { valid: boolean; error?: string };
  omdb: { valid: boolean; error?: string };
}

export class StartupService {
  static init(): void {
    ipcMain.handle(IPC_CHANNELS.VALIDATE_KEYS, async () => {
      return this.validateAllKeys();
    });
  }

  static async validateAllKeys(): Promise<KeyValidationResult> {
    const settings = await getSettings();

    const [tmdbResult, omdbResult] = await Promise.all([
      this.validateTmdb(settings.tmdbApiKey),
      this.validateOmdb(settings.omdbApiKey),
    ]);

    return {
      tmdb: tmdbResult,
      omdb: omdbResult,
    };
  }

  static async validateTmdb(
    apiKey: string | undefined,
  ): Promise<{ valid: boolean; error?: string }> {
    if (!apiKey) return { valid: false, error: 'MISSING_KEY' };
    return TmdbService.validateApiKey(apiKey);
  }

  static async validateOmdb(
    apiKey: string | undefined,
  ): Promise<{ valid: boolean; error?: string }> {
    if (!apiKey) return { valid: false, error: 'MISSING_KEY' };
    return OmdbService.validateApiKey(apiKey);
  }
}
