import { spawn } from 'child_process';
import { app } from 'electron';
import { arch, platform } from 'os';
import { basename, dirname, extname, join } from 'path';
import {
    AudioStream,
    MediaFile,
    SubtitleStream,
    VideoStream,
    categorizeChannels,
    categorizeResolution,
} from '../models';

/**
 * Gets the correct path to the ffprobe binary.
 * In development, uses the ffprobe-static package path.
 * In packaged apps, uses the unpacked asar path.
 */
function getFFprobePath(): string {
  if (app.isPackaged) {
    const ffprobeBinary = platform() === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    const binPath = join('node_modules', 'ffprobe-static', 'bin', platform(), arch(), ffprobeBinary);
    return join(process.resourcesPath, 'app.asar.unpacked', binPath);
  }
  
  // In development, use the path from ffprobe-static package
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('ffprobe-static').path;
}

interface FFprobeOutput {
  streams: FFprobeStream[];
  format: FFprobeFormat;
}

interface FFprobeStream {
  index: number;
  codec_name: string;
  codec_type: 'video' | 'audio' | 'subtitle';
  width?: number;
  height?: number;
  display_aspect_ratio?: string;
  r_frame_rate?: string;
  bit_rate?: string;
  profile?: string;
  channels?: number;
  channel_layout?: string;
  sample_rate?: string;
  tags?: {
    language?: string;
    title?: string;
    DURATION?: string;
  };
  disposition?: {
    default?: number;
    forced?: number;
  };
}

interface FFprobeFormat {
  filename: string;
  format_name: string;
  duration?: string;
  size?: string;
  bit_rate?: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function parseFrameRate(frameRate?: string): number | undefined {
  if (!frameRate) return undefined;
  const parts = frameRate.split('/');
  if (parts.length === 2) {
    const num = parseInt(parts[0], 10);
    const den = parseInt(parts[1], 10);
    if (den > 0) return Math.round((num / den) * 100) / 100;
  }
  return undefined;
}

function parseVideoStream(stream: FFprobeStream): VideoStream {
  const width = stream.width ?? 0;
  const height = stream.height ?? 0;
  
  return {
    index: stream.index,
    codec: stream.codec_name,
    width,
    height,
    aspectRatio: stream.display_aspect_ratio,
    frameRate: parseFrameRate(stream.r_frame_rate),
    bitrate: stream.bit_rate ? parseInt(stream.bit_rate, 10) : undefined,
    profile: stream.profile,
    resolution: categorizeResolution(width, height),
  };
}

function parseAudioStream(stream: FFprobeStream): AudioStream {
  const channels = stream.channels ?? 0;
  
  return {
    index: stream.index,
    codec: stream.codec_name,
    channels,
    channelType: categorizeChannels(channels, stream.codec_name),
    language: stream.tags?.language,
    title: stream.tags?.title,
    bitrate: stream.bit_rate ? parseInt(stream.bit_rate, 10) : undefined,
    sampleRate: stream.sample_rate ? parseInt(stream.sample_rate, 10) : undefined,
    isDefault: stream.disposition?.default === 1 ? true : undefined,
  };
}

function parseSubtitleStream(stream: FFprobeStream): SubtitleStream {
  return {
    index: stream.index,
    codec: stream.codec_name,
    language: stream.tags?.language,
    title: stream.tags?.title,
    isForced: stream.disposition?.forced === 1 ? true : undefined,
    isDefault: stream.disposition?.default === 1 ? true : undefined,
  };
}

export function probeFile(filePath: string): Promise<MediaFile> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];

    const proc = spawn(getFFprobePath(), args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFprobe exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const output: FFprobeOutput = JSON.parse(stdout);
        const format = output.format;
        const streams = output.streams;

        const videoStreams = streams
          .filter((s) => s.codec_type === 'video')
          .map(parseVideoStream);

        const audioStreams = streams
          .filter((s) => s.codec_type === 'audio')
          .map(parseAudioStream);

        const subtitleStreams = streams
          .filter((s) => s.codec_type === 'subtitle')
          .map(parseSubtitleStream);

        const mediaFile: MediaFile = {
          id: generateId(),
          path: filePath,
          filename: basename(filePath),
          directory: dirname(filePath),
          extension: extname(filePath).toLowerCase(),
          sizeBytes: format.size ? parseInt(format.size, 10) : 0,
          duration: format.duration ? parseFloat(format.duration) : undefined,
          container: format.format_name,
          bitrate: format.bit_rate ? parseInt(format.bit_rate, 10) : undefined,
          videoStreams,
          audioStreams,
          subtitleStreams,
          scannedAt: Date.now(),
        };

        resolve(mediaFile);
      } catch (parseError) {
        reject(new Error(`Failed to parse FFprobe output: ${parseError}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn FFprobe: ${err.message}`));
    });
  });
}
