import * as Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import { MediaFile } from '../models';

let db: Database.Database | null = null;

export const DatabaseService = {
  init(): void {
    if (db) return;

    console.log('[Database] Initializing SQLite database...');
    // Must be called after app is ready
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'archivist-cache.db');
    console.log(`[Database] DB Path: ${dbPath}`);

    db = new Database(dbPath);

    // Enable WAL mode for better performance and concurrency
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    // Create schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS media_files (
        id TEXT PRIMARY KEY,
        path TEXT UNIQUE,
        filename TEXT,
        directory TEXT,
        extension TEXT,
        sizeBytes INTEGER,
        duration REAL,
        container TEXT,
        bitrate INTEGER,
        videoStreams TEXT,
        audioStreams TEXT,
        subtitleStreams TEXT,
        scannedAt INTEGER,
        modifiedAt INTEGER,
        pathContext TEXT,
        isClean INTEGER DEFAULT 0,
        suggestedName TEXT,
        isIgnored INTEGER DEFAULT 0,
        analysisResult TEXT
      );

      CREATE TABLE IF NOT EXISTS queue_tasks (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        error TEXT,
        createdAt INTEGER,
        updatedAt INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_media_files_path ON media_files(path);
      CREATE INDEX IF NOT EXISTS idx_media_files_directory ON media_files(directory);
      CREATE INDEX IF NOT EXISTS idx_queue_tasks_status ON queue_tasks(status);
    `);
    console.log('[Database] Database initialized and schema verified.');
  },

  close(): void {
    if (db) {
      db.close();
      db = null;
    }
  },

  getAllFiles(): MediaFile[] {
    if (!db) this.init();

    const stmt = db!.prepare('SELECT * FROM media_files');
    const rows = stmt.all() as any[];

    return rows.map((row) => {
      const mediaFile: MediaFile = {
        ...row,
        isClean: row.isClean === 1,
        isIgnored: row.isIgnored === 1,
      };
      // Parse JSON strings back to objects
      if (row.videoStreams)
        mediaFile.videoStreams = JSON.parse(row.videoStreams);
      if (row.audioStreams)
        mediaFile.audioStreams = JSON.parse(row.audioStreams);
      if (row.subtitleStreams)
        mediaFile.subtitleStreams = JSON.parse(row.subtitleStreams);
      if (row.pathContext) mediaFile.pathContext = JSON.parse(row.pathContext);
      return mediaFile;
    });
  },

  upsertBatch(files: MediaFile[]): void {
    if (!db) this.init();
    if (files.length === 0) return;

    const stmt = db!.prepare(`
      INSERT INTO media_files (
        id, path, filename, directory, extension, sizeBytes, duration, container, bitrate,
        videoStreams, audioStreams, subtitleStreams, scannedAt, modifiedAt, pathContext,
        isClean, suggestedName, isIgnored, analysisResult
      ) VALUES (
        @id, @path, @filename, @directory, @extension, @sizeBytes, @duration, @container, @bitrate,
        @videoStreams, @audioStreams, @subtitleStreams, @scannedAt, @modifiedAt, @pathContext,
        @isClean, @suggestedName, @isIgnored, @analysisResult
      )
      ON CONFLICT(path) DO UPDATE SET
        filename = excluded.filename,
        directory = excluded.directory,
        extension = excluded.extension,
        sizeBytes = excluded.sizeBytes,
        duration = excluded.duration,
        container = excluded.container,
        bitrate = excluded.bitrate,
        videoStreams = excluded.videoStreams,
        audioStreams = excluded.audioStreams,
        subtitleStreams = excluded.subtitleStreams,
        scannedAt = excluded.scannedAt,
        modifiedAt = excluded.modifiedAt,
        pathContext = excluded.pathContext,
        isClean = excluded.isClean,
        suggestedName = excluded.suggestedName,
        isIgnored = excluded.isIgnored,
        analysisResult = excluded.analysisResult
    `);

    const insertMany = db!.transaction((mediaFiles: MediaFile[]) => {
      for (const file of mediaFiles) {
        stmt.run({
          // Core fields
          id: file.id,
          path: file.path,
          filename: file.filename,
          directory: file.directory,
          extension: file.extension,
          sizeBytes: file.sizeBytes,
          scannedAt: file.scannedAt,
          modifiedAt: file.modifiedAt,

          // Optional fields with defaults
          duration: file.duration ?? null,
          container: file.container ?? null,
          bitrate: file.bitrate ?? null,

          // AI / Optimization fields with strict defaults
          isClean: file.isClean ? 1 : 0,
          suggestedName: file.suggestedName ?? null,
          isIgnored: file.isIgnored ? 1 : 0,
          analysisResult: file.analysisResult ?? null,

          // JSON fields
          videoStreams: file.videoStreams
            ? JSON.stringify(file.videoStreams)
            : '[]',
          audioStreams: file.audioStreams
            ? JSON.stringify(file.audioStreams)
            : '[]',
          subtitleStreams: file.subtitleStreams
            ? JSON.stringify(file.subtitleStreams)
            : '[]',
          pathContext: file.pathContext
            ? JSON.stringify(file.pathContext)
            : null,
        });
      }
    });

    insertMany(files);
  },

  deleteFiles(paths: string[]): void {
    if (!db) this.init();
    if (paths.length === 0) return;

    // Delete in chunks to avoid SQLite query parameter limit if array is very large
    const chunkSize = 100;

    const transaction = db!.transaction((pathsChunk: string[]) => {
      const placeholders = pathsChunk.map(() => '?').join(',');
      db!
        .prepare(`DELETE FROM media_files WHERE path IN (${placeholders})`)
        .run(...pathsChunk);
    });

    for (let i = 0; i < paths.length; i += chunkSize) {
      transaction(paths.slice(i, i + chunkSize));
    }
  },

  clear(): void {
    if (!db) this.init();
    db!.prepare('DELETE FROM media_files').run();
  },

  updateAIState(
    path: string,
    state: {
      isClean?: boolean;
      suggestedName?: string;
      isIgnored?: boolean;
      analysisResult?: string;
    },
  ): void {
    if (!db) this.init();
    const sets: string[] = [];
    const params: any = { path };

    if (state.isClean !== undefined) {
      sets.push('isClean = @isClean');
      params.isClean = state.isClean ? 1 : 0;
    }
    if (state.suggestedName !== undefined) {
      sets.push('suggestedName = @suggestedName');
      params.suggestedName = state.suggestedName;
    }
    if (state.isIgnored !== undefined) {
      sets.push('isIgnored = @isIgnored');
      params.isIgnored = state.isIgnored ? 1 : 0;
    }
    if (state.analysisResult !== undefined) {
      sets.push('analysisResult = @analysisResult');
      params.analysisResult = state.analysisResult;
    }

    if (sets.length === 0) return;

    db!
      .prepare(
        `
      UPDATE media_files
      SET ${sets.join(', ')}
      WHERE path = @path
    `,
      )
      .run(params);
  },

  getFileAIState(path: string): {
    isClean: boolean;
    suggestedName: string | null;
    isIgnored: boolean;
    analysisResult: string | null;
  } | null {
    if (!db) this.init();
    const row = db!
      .prepare(
        `
      SELECT isClean, suggestedName, isIgnored, analysisResult
      FROM media_files
      WHERE path = ?
    `,
      )
      .get(path) as any;

    if (!row) return null;

    return {
      isClean: row.isClean === 1,
      suggestedName: row.suggestedName,
      isIgnored: row.isIgnored === 1,
      analysisResult: row.analysisResult,
    };
  },

  clearAIState(): void {
    if (!db) this.init();
    db!
      .prepare(
        `
      UPDATE media_files
      SET isClean = 0, suggestedName = NULL, isIgnored = 0, analysisResult = NULL
    `,
      )
      .run();
  },

  /**
   * Retrieves all media files that have AI analysis results or are marked clean.
   */
  getAIResults(): MediaFile[] {
    if (!db) this.init();
    const rows = db!
      .prepare(
        `
      SELECT * FROM media_files 
      WHERE isClean = 1 OR suggestedName IS NOT NULL
    `,
      )
      .all() as any[];

    return rows.map((row) => {
      const mediaFile: MediaFile = {
        ...row,
        isClean: row.isClean === 1,
        isIgnored: row.isIgnored === 1,
      };
      if (row.videoStreams)
        mediaFile.videoStreams = JSON.parse(row.videoStreams);
      if (row.audioStreams)
        mediaFile.audioStreams = JSON.parse(row.audioStreams);
      if (row.subtitleStreams)
        mediaFile.subtitleStreams = JSON.parse(row.subtitleStreams);
      if (row.pathContext) mediaFile.pathContext = JSON.parse(row.pathContext);
      return mediaFile;
    });
  },

  // --- Task Queue Methods ---

  addTask(task: {
    id: string;
    type: string;
    payload: string;
    status: string;
    createdAt: number;
    updatedAt: number;
  }): void {
    if (!db) this.init();
    db!
      .prepare(
        `
      INSERT INTO queue_tasks (id, type, payload, status, createdAt, updatedAt)
      VALUES (@id, @type, @payload, @status, @createdAt, @updatedAt)
    `,
      )
      .run(task);
  },

  deleteTask(id: string): void {
    if (!db) this.init();
    db!.prepare('DELETE FROM queue_tasks WHERE id = ?').run(id);
  },

  getTasks(): any[] {
    if (!db) this.init();
    return db!
      .prepare('SELECT * FROM queue_tasks ORDER BY createdAt ASC')
      .all();
  },

  getNextPendingTask(): any | null {
    if (!db) this.init();
    return (
      db!
        .prepare(
          "SELECT * FROM queue_tasks WHERE status = 'pending' ORDER BY createdAt ASC LIMIT 1",
        )
        .get() || null
    );
  },

  updateTaskStatus(id: string, status: string, error?: string): void {
    if (!db) this.init();
    const updatedAt = Date.now();
    if (error !== undefined) {
      db!
        .prepare(
          `
        UPDATE queue_tasks 
        SET status = ?, error = ?, updatedAt = ? 
        WHERE id = ?
      `,
        )
        .run(status, error, updatedAt, id);
    } else {
      db!
        .prepare(
          `
        UPDATE queue_tasks 
        SET status = ?, updatedAt = ? 
        WHERE id = ?
      `,
        )
        .run(status, updatedAt, id);
    }
  },

  clearFinishedTasks(): void {
    if (!db) this.init();
    db!
      .prepare("DELETE FROM queue_tasks WHERE status IN ('success', 'error')")
      .run();
  },
};
