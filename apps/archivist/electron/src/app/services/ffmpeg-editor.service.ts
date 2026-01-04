import { spawn } from 'child_process';
import { app, BrowserWindow } from 'electron';
import { access, constants } from 'fs/promises';
import { platform } from 'os';
import { basename, dirname, extname, join } from 'path';

/**
 * Gets the correct path to the ffmpeg binary.
 */
function getFFmpegPath(): string {
  const ffmpegBinary = platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  
  if (app.isPackaged) {
    const binPath = join('node_modules', 'ffmpeg-static', ffmpegBinary);
    return join(process.resourcesPath, 'app.asar.unpacked', binPath);
  }
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staticPath = require('ffmpeg-static');
    if (staticPath) return staticPath;
  } catch {
    // Fallback
  }
  
  try {
    const packagePath = require.resolve('ffmpeg-static/package.json');
    const packageDir = dirname(packagePath);
    return join(packageDir, ffmpegBinary);
  } catch {
    return join(process.cwd(), 'node_modules', 'ffmpeg-static', ffmpegBinary);
  }
}

// ============================================================================
// Types
// ============================================================================

export type ContainerFormat = 'mkv' | 'mp4' | 'avi' | 'mov' | 'webm' | 'ts';
export type VideoCodec = 'copy' | 'h264' | 'h265' | 'vp9' | 'av1';
export type AudioCodec = 'copy' | 'aac' | 'ac3' | 'mp3' | 'flac' | 'opus';
export type SubtitleFormat = 'srt' | 'ass' | 'vtt';

export interface EditorProgress {
  percent: number;
  timeProcessed?: string;
  speed?: string;
  currentFrame?: number;
}

export interface EditorResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

export interface VideoTranscodeOptions {
  codec: VideoCodec;
  crf?: number; // 0-51 for h264/h265, lower = better quality
  bitrate?: number; // in kbps, alternative to CRF
  preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
}

export interface AudioTranscodeOptions {
  codec: AudioCodec;
  bitrate?: number; // in kbps (e.g., 128, 192, 256, 320)
  channels?: number; // 1 = mono, 2 = stereo, 6 = 5.1
  sampleRate?: number; // e.g., 44100, 48000
}

// ============================================================================
// FFmpeg Command Builder
// ============================================================================

/**
 * Generate output filename with suffix before extension
 */
function generateOutputPath(inputPath: string, suffix: string, newExtension?: string): string {
  const dir = dirname(inputPath);
  const ext = newExtension ? `.${newExtension}` : extname(inputPath);
  const baseName = basename(inputPath, extname(inputPath));
  return join(dir, `${baseName}${suffix}${ext}`);
}

/**
 * Map codec names to FFmpeg codec identifiers
 */
function getVideoCodecArg(codec: VideoCodec): string {
  const map: Record<VideoCodec, string> = {
    copy: 'copy',
    h264: 'libx264',
    h265: 'libx265',
    vp9: 'libvpx-vp9',
    av1: 'libaom-av1',
  };
  return map[codec];
}

function getAudioCodecArg(codec: AudioCodec): string {
  const map: Record<AudioCodec, string> = {
    copy: 'copy',
    aac: 'aac',
    ac3: 'ac3',
    mp3: 'libmp3lame',
    flac: 'flac',
    opus: 'libopus',
  };
  return map[codec];
}

// ============================================================================
// FFmpeg Runner with Progress
// ============================================================================

interface FFmpegRunOptions {
  args: string[];
  duration?: number; // Total duration in seconds for progress calculation
  mainWindow?: BrowserWindow;
}

function runFFmpegWithProgress(options: FFmpegRunOptions): Promise<void> {
  const { args, duration, mainWindow } = options;
  
  return new Promise((resolve, reject) => {
    const proc = spawn(getFFmpegPath(), args, { stdio: 'pipe' });
    
    let stderr = '';
    
    proc.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      
      // Parse progress from FFmpeg output
      if (mainWindow && duration) {
        const timeMatch = chunk.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const seconds = parseInt(timeMatch[3], 10);
          const timeProcessed = hours * 3600 + minutes * 60 + seconds;
          const percent = Math.min(100, Math.round((timeProcessed / duration) * 100));
          
          const speedMatch = chunk.match(/speed=\s*([\d.]+)x/);
          const frameMatch = chunk.match(/frame=\s*(\d+)/);
          
          const progress: EditorProgress = {
            percent,
            timeProcessed: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
            speed: speedMatch ? `${speedMatch[1]}x` : undefined,
            currentFrame: frameMatch ? parseInt(frameMatch[1], 10) : undefined,
          };
          
          mainWindow.webContents.send('editor-progress', progress);
        }
      }
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

// ============================================================================
// Editor Operations
// ============================================================================

/**
 * Convert container format (stream copy - no re-encoding)
 */
export async function convertContainer(
  inputPath: string,
  format: ContainerFormat,
  mainWindow?: BrowserWindow,
  duration?: number,
): Promise<EditorResult> {
  try {
    await access(inputPath, constants.R_OK);
    
    const outputPath = generateOutputPath(inputPath, '_converted', format);
    
    const args = [
      '-i', inputPath,
      '-c', 'copy', // Copy all streams without re-encoding
      '-map', '0', // Map all streams
      '-y', outputPath,
    ];
    
    await runFFmpegWithProgress({ args, duration, mainWindow });
    
    return { success: true, outputPath };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Transcode video to different codec
 */
export async function transcodeVideo(
  inputPath: string,
  options: VideoTranscodeOptions,
  mainWindow?: BrowserWindow,
  duration?: number,
): Promise<EditorResult> {
  try {
    await access(inputPath, constants.R_OK);
    
    const ext = extname(inputPath);
    const outputPath = generateOutputPath(inputPath, `_${options.codec}`, ext.slice(1));
    
    const args = ['-i', inputPath];
    
    // Video codec
    args.push('-c:v', getVideoCodecArg(options.codec));
    
    if (options.codec !== 'copy') {
      // Quality settings
      if (options.bitrate) {
        args.push('-b:v', `${options.bitrate}k`);
      } else if (options.crf !== undefined) {
        args.push('-crf', String(options.crf));
      } else {
        // Default CRF values
        args.push('-crf', options.codec === 'h265' ? '28' : '23');
      }
      
      // Preset
      if (options.preset) {
        args.push('-preset', options.preset);
      }
    }
    
    // Copy audio and subtitles
    args.push('-c:a', 'copy');
    args.push('-c:s', 'copy');
    args.push('-map', '0');
    args.push('-y', outputPath);
    
    await runFFmpegWithProgress({ args, duration, mainWindow });
    
    return { success: true, outputPath };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Transcode audio to different codec
 */
export async function transcodeAudio(
  inputPath: string,
  options: AudioTranscodeOptions,
  mainWindow?: BrowserWindow,
  duration?: number,
): Promise<EditorResult> {
  try {
    await access(inputPath, constants.R_OK);
    
    const ext = extname(inputPath);
    const outputPath = generateOutputPath(inputPath, `_${options.codec}`, ext.slice(1));
    
    const args = ['-i', inputPath];
    
    // Copy video and subtitles
    args.push('-c:v', 'copy');
    args.push('-c:s', 'copy');
    
    // Audio codec
    args.push('-c:a', getAudioCodecArg(options.codec));
    
    if (options.codec !== 'copy') {
      if (options.bitrate) {
        args.push('-b:a', `${options.bitrate}k`);
      }
      if (options.channels) {
        args.push('-ac', String(options.channels));
      }
      if (options.sampleRate) {
        args.push('-ar', String(options.sampleRate));
      }
    }
    
    args.push('-map', '0');
    args.push('-y', outputPath);
    
    await runFFmpegWithProgress({ args, duration, mainWindow });
    
    return { success: true, outputPath };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Extract subtitle track to external file
 */
export async function extractSubtitle(
  inputPath: string,
  trackIndex: number,
  format: SubtitleFormat,
  outputPath?: string,
): Promise<EditorResult> {
  try {
    await access(inputPath, constants.R_OK);
    
    const output = outputPath || generateOutputPath(inputPath, `_subtitle_${trackIndex}`, format);
    
    const args = [
      '-i', inputPath,
      '-map', `0:s:${trackIndex}`, // Select specific subtitle stream
      '-c:s', format === 'srt' ? 'srt' : format === 'ass' ? 'ass' : 'webvtt',
      '-y', output,
    ];
    
    await runFFmpegWithProgress({ args });
    
    return { success: true, outputPath: output };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Add external subtitle file to container
 */
export async function addSubtitle(
  inputPath: string,
  subtitlePath: string,
  language?: string,
  mainWindow?: BrowserWindow,
  duration?: number,
): Promise<EditorResult> {
  try {
    await access(inputPath, constants.R_OK);
    await access(subtitlePath, constants.R_OK);
    
    const ext = extname(inputPath);
    const outputPath = generateOutputPath(inputPath, '_with_subs', ext.slice(1));
    
    const args = [
      '-i', inputPath,
      '-i', subtitlePath,
      '-c', 'copy', // Copy all streams
      '-map', '0', // All streams from first input
      '-map', '1', // All streams from second input (subtitle)
    ];
    
    if (language) {
      args.push('-metadata:s:s:0', `language=${language}`);
    }
    
    args.push('-y', outputPath);
    
    await runFFmpegWithProgress({ args, duration, mainWindow });
    
    return { success: true, outputPath };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Remove subtitle track from file
 */
export async function removeSubtitle(
  inputPath: string,
  trackIndex: number,
  mainWindow?: BrowserWindow,
  duration?: number,
): Promise<EditorResult> {
  try {
    await access(inputPath, constants.R_OK);
    
    const ext = extname(inputPath);
    const outputPath = generateOutputPath(inputPath, '_no_sub', ext.slice(1));
    
    // Build complex mapping to exclude specific subtitle track
    const args = [
      '-i', inputPath,
      '-c', 'copy',
      '-map', '0',
      '-map', `-0:s:${trackIndex}`, // Negative mapping to exclude
      '-y', outputPath,
    ];
    
    await runFFmpegWithProgress({ args, duration, mainWindow });
    
    return { success: true, outputPath };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Set default subtitle track
 */
export async function setDefaultSubtitle(
  inputPath: string,
  trackIndex: number,
  mainWindow?: BrowserWindow,
  duration?: number,
): Promise<EditorResult> {
  try {
    await access(inputPath, constants.R_OK);
    
    const ext = extname(inputPath);
    const outputPath = generateOutputPath(inputPath, '_default_sub', ext.slice(1));
    
    const args = [
      '-i', inputPath,
      '-c', 'copy',
      '-map', '0',
      '-disposition:s', '0', // Reset all subtitle dispositions
      `-disposition:s:${trackIndex}`, 'default', // Set this one as default
      '-y', outputPath,
    ];
    
    await runFFmpegWithProgress({ args, duration, mainWindow });
    
    return { success: true, outputPath };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run custom FFmpeg command
 */
export async function runCustomCommand(
  commandString: string,
  mainWindow?: BrowserWindow,
): Promise<EditorResult> {
  try {
    // Parse command string into arguments
    // Handle quoted strings properly
    const args = parseCommandString(commandString);
    
    if (args.length === 0) {
      return { success: false, error: 'Empty command' };
    }
    
    // Find output path (last non-option argument)
    let outputPath: string | undefined;
    for (let i = args.length - 1; i >= 0; i--) {
      if (!args[i].startsWith('-')) {
        outputPath = args[i];
        break;
      }
    }
    
    await runFFmpegWithProgress({ args, mainWindow });
    
    return { success: true, outputPath };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Parse command string into arguments, respecting quotes
 */
function parseCommandString(command: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    
    if ((char === '"' || char === "'") && !inQuote) {
      inQuote = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuote) {
      inQuote = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuote) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  
  if (current.length > 0) {
    args.push(current);
  }
  
  return args;
}
