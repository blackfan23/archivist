import { spawn } from 'child_process';
import { stat } from 'fs';
import { basename, dirname, extname } from 'path';
import { promisify } from 'util';
import { parentPort } from 'worker_threads';

const statAsync = promisify(stat);

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

// Inlined categorization logic to avoid complex imports in worker for now
// (Matches models.ts logic)
function categorizeResolution(width: number, height: number): string {
  if (width >= 3840 || height >= 2160) return '4K';
  if (width >= 1920 || height >= 1080) return '1080p';
  if (width >= 1280 || height >= 720) return '720p';
  if (width >= 720 || height >= 480) return 'SD';
  return 'Unknown';
}

function categorizeChannels(channels: number, codec: string): string {
  if (channels >= 6) return '5.1+';
  if (channels === 2) return 'Stereo';
  if (channels === 1) return 'Mono';
  return 'Unknown';
}

async function probeFile(filePath: string, ffprobePath: string): Promise<any> {
  const fileStat = await statAsync(filePath);
  const modifiedAt = fileStat.mtimeMs;

  return new Promise((resolve, reject) => {
    const args = [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];

    const proc = spawn(ffprobePath, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });

    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFprobe exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const output = JSON.parse(stdout);
        const format = output.format;
        const streams = output.streams || [];

        const videoStreams = streams
          .filter((s: any) => s.codec_type === 'video')
          .map((s: any) => ({
            index: s.index,
            codec: s.codec_name,
            width: s.width ?? 0,
            height: s.height ?? 0,
            aspectRatio: s.display_aspect_ratio,
            frameRate: parseFrameRate(s.r_frame_rate),
            bitrate: s.bit_rate ? parseInt(s.bit_rate, 10) : undefined,
            profile: s.profile,
            resolution: categorizeResolution(s.width ?? 0, s.height ?? 0),
          }));

        const audioStreams = streams
          .filter((s: any) => s.codec_type === 'audio')
          .map((s: any) => ({
            index: s.index,
            codec: s.codec_name,
            channels: s.channels ?? 0,
            channelType: categorizeChannels(s.channels ?? 0, s.codec_name),
            language: s.tags?.language,
            title: s.tags?.title,
            bitrate: s.bit_rate ? parseInt(s.bit_rate, 10) : undefined,
            sampleRate: s.sample_rate ? parseInt(s.sample_rate, 10) : undefined,
            isDefault: s.disposition?.default === 1 ? true : undefined,
          }));

        const subtitleStreams = streams
          .filter((s: any) => s.codec_type === 'subtitle')
          .map((s: any) => ({
            index: s.index,
            codec: s.codec_name,
            language: s.tags?.language,
            title: s.tags?.title,
            isForced: s.disposition?.forced === 1 ? true : undefined,
            isDefault: s.disposition?.default === 1 ? true : undefined,
          }));

        const mediaFile = {
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
          modifiedAt,
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

parentPort?.on(
  'message',
  async (data: { batch: string[]; ffprobePath: string }) => {
    const { batch, ffprobePath } = data;
    const results: any[] = [];
    const errors: any[] = [];

    const probePromises = batch.map(async (filePath) => {
      try {
        const result = await probeFile(filePath, ffprobePath);
        return { result };
      } catch (err: any) {
        return { error: { path: filePath, error: err.message || String(err) } };
      }
    });

    const settled = await Promise.all(probePromises);
    for (const item of settled) {
      if (item.result) results.push(item.result);
      if (item.error) errors.push(item.error);
    }

    parentPort?.postMessage({ results, errors });
  },
);
