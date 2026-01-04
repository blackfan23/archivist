import { spawn } from 'child_process';
import { app } from 'electron';
import { access, constants, rename, unlink } from 'fs/promises';
import { platform } from 'os';
import { dirname, extname, join } from 'path';

/**
 * Gets the correct path to the ffmpeg binary.
 * In development, uses the ffmpeg-static package path.
 * In packaged apps, uses the unpacked asar path.
 */
function getFFmpegPath(): string {
  const ffmpegBinary = platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  
  if (app.isPackaged) {
    const binPath = join('node_modules', 'ffmpeg-static', ffmpegBinary);
    return join(process.resourcesPath, 'app.asar.unpacked', binPath);
  }
  
  // In development, resolve the package path and find the binary
  // Using require.resolve to find the package, then navigate to the binary
  try {
    // First try to use ffmpeg-static directly
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staticPath = require('ffmpeg-static');
    if (staticPath) return staticPath;
  } catch {
    // Fallback: resolve manually
  }
  
  // Fallback: find the package.json and navigate to the binary
  try {
    const packagePath = require.resolve('ffmpeg-static/package.json');
    const packageDir = dirname(packagePath);
    return join(packageDir, ffmpegBinary);
  } catch {
    // Last resort: try common workspace location
    return join(process.cwd(), 'node_modules', 'ffmpeg-static', ffmpegBinary);
  }
}

export interface MediaMetadata {
  title: string;
  year?: string;
  description?: string;
  show?: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
}

/**
 * Embed metadata into a video file using ffmpeg.
 * Creates a temporary file and replaces the original on success.
 */
export async function embedMetadata(
  filePath: string,
  metadata: MediaMetadata,
): Promise<void> {
  // Verify ffmpeg is available
  await verifyFfmpegExists();

  // Verify source file exists
  await access(filePath, constants.R_OK | constants.W_OK);

  const dir = dirname(filePath);
  const ext = extname(filePath);
  const tempPath = join(dir, `.temp_${Date.now()}${ext}`);

  try {
    // Build ffmpeg arguments
    const args = [
      '-i', filePath,
      '-c', 'copy', // Copy streams without re-encoding
      '-map', '0', // Map all streams
    ];

    // Add metadata flags
    if (metadata.title) {
      args.push('-metadata', `title=${metadata.title}`);
    }
    if (metadata.year) {
      args.push('-metadata', `date=${metadata.year}`);
      args.push('-metadata', `year=${metadata.year}`);
    }
    if (metadata.description) {
      args.push('-metadata', `description=${metadata.description}`);
      args.push('-metadata', `synopsis=${metadata.description}`);
    }
    if (metadata.show) {
      args.push('-metadata', `show=${metadata.show}`);
    }
    if (metadata.season !== undefined) {
      args.push('-metadata', `season_number=${metadata.season}`);
    }
    if (metadata.episode !== undefined) {
      args.push('-metadata', `episode_sort=${metadata.episode}`);
    }
    if (metadata.episodeTitle) {
      args.push('-metadata', `episode_id=${metadata.episodeTitle}`);
    }

    // Output to temp file
    args.push('-y', tempPath);

    // Run ffmpeg
    await runFfmpeg(args);

    // Replace original with temp file
    await unlink(filePath);
    await rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Rename a file to a new name based on TMDB match data.
 * Returns the new file path.
 */
export function generateFilename(
  originalPath: string,
  metadata: MediaMetadata,
): string {
  const ext = extname(originalPath);
  const dir = dirname(originalPath);

  let newName: string;

  if (metadata.show && metadata.season !== undefined && metadata.episode !== undefined) {
    // TV episode format: "Show Name - S01E05 - Episode Title"
    const seasonStr = String(metadata.season).padStart(2, '0');
    const episodeStr = String(metadata.episode).padStart(2, '0');
    
    if (metadata.episodeTitle) {
      newName = `${metadata.show} - S${seasonStr}E${episodeStr} - ${metadata.episodeTitle}`;
    } else {
      newName = `${metadata.show} - S${seasonStr}E${episodeStr}`;
    }
  } else {
    // Movie format: "Title (Year)"
    if (metadata.year) {
      newName = `${metadata.title} (${metadata.year})`;
    } else {
      newName = metadata.title;
    }
  }

  // Sanitize filename - remove invalid characters
  newName = sanitizeFilename(newName);

  return join(dir, newName + ext);
}

/**
 * Generate folder name based on TMDB match data.
 * For movies: "Title (Year)"
 * For TV shows: "Show Name/Season 01" format
 */
export function generateFolderName(metadata: MediaMetadata): string {
  let folderName: string;

  if (metadata.show && metadata.season !== undefined) {
    // TV show format: "Show Name - Season 01"
    const seasonStr = String(metadata.season).padStart(2, '0');
    folderName = `${metadata.show} - Season ${seasonStr}`;
  } else {
    // Movie format: "Title (Year)"
    if (metadata.year) {
      folderName = `${metadata.title} (${metadata.year})`;
    } else {
      folderName = metadata.title;
    }
  }

  return sanitizeFilename(folderName);
}

/**
 * Remove characters that are invalid in filenames
 */
function sanitizeFilename(name: string): string {
  // Replace invalid characters with safe alternatives
  return name
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Verify ffmpeg is installed and accessible
 */
async function verifyFfmpegExists(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(getFFmpegPath(), ['-version'], {
      stdio: 'pipe',
    });

    proc.on('error', () => {
      reject(new Error('ffmpeg not found. Please install ffmpeg to embed metadata.'));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('ffmpeg check failed'));
      }
    });
  });
}

/**
 * Run ffmpeg with the given arguments
 */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(getFFmpegPath(), args, {
      stdio: 'pipe',
    });

    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to run ffmpeg: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg failed with code ${code}: ${stderr.slice(-500)}`));
      }
    });
  });
}
