import {
  array,
  boolean,
  InferOutput,
  literal,
  nullable,
  number,
  object,
  optional,
  string,
  union,
} from 'valibot';
import { AISettings } from './ai.models';

// --- FFmpeg Editor Types ---
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
  preset?:
    | 'ultrafast'
    | 'superfast'
    | 'veryfast'
    | 'faster'
    | 'fast'
    | 'medium'
    | 'slow'
    | 'slower'
    | 'veryslow';
}

export interface AudioTranscodeOptions {
  codec: AudioCodec;
  bitrate?: number; // in kbps (e.g., 128, 192, 256, 320)
  channels?: number; // 1 = mono, 2 = stereo, 6 = 5.1
  sampleRate?: number; // e.g., 44100, 48000
}

export interface MatchFileResult {
  newPath: string;
  success: boolean;
  error?: string;
}

export interface DeleteResult extends BatchResult {
  foldersDeleted: number;
  folderErrors: Array<{ path: string; error: string }>;
}

// --- Series Info ---
export interface SeriesInfo {
  showTitle: string;
  year: string;
  season: number;
  episode: number;
  episodeTitle?: string;
  tmdbShowId: number;
}

// --- Analysis Types ---
export const AnalysisResultSchema = object({
  filePath: string(),
  originalName: string(),
  suggestedName: string(),
  isClean: boolean(),
  score: number(),
  reason: string(),
  /** Computed target folder path relative to scan root (TV only). e.g. "Lost (2004)/Season 1" */
  seriesRoot: optional(string()),
  /** Whether AI LLM extraction was used as a fallback for this result */
  isAiFallback: optional(boolean()),
  /** Whether the file is missing on disk (detected via TMDB but not found locally) */
  isMissing: optional(boolean()),
  /** File size in bytes (if available) */
  sizeBytes: optional(number()),
  metadata: object({
    title: string(),
    year: string(),
    tmdbId: optional(number()),
    season: optional(number()),
    episode: optional(number()),
    episodeTitle: optional(string()),
    posterUrl: optional(nullable(string())),
    type: optional(union([literal('movie'), literal('tv')])),
  }),
  matches: optional(
    array(
      object({
        id: number(),
        type: union([literal('movie'), literal('tv')]),
        title: string(),
        year: string(),
        rating: number(),
        posterUrl: nullable(string()),
        overview: string(),
      }),
    ),
  ),
});
export type AnalysisResult = InferOutput<typeof AnalysisResultSchema>;

// --- TMDB Types ---
export interface TmdbSearchResult {
  id: number;
  title: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
  poster_path: string | null;
  overview: string;
}

export interface TmdbMovieDetails {
  id: number;
  imdb_id: string;
  title: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
  runtime: number;
  genres: Array<{ id: number; name: string }>;
  poster_path: string | null;
  overview: string;
}

export interface TmdbRating {
  tmdbId: number;
  imdbId: string;
  title: string;
  year: string;
  rating: number;
  voteCount: number;
  runtime: string;
  genre: string;
  posterUrl: string | null;
  overview: string;
  fetchedAt: number;
}

// Multi-search result types
export interface TmdbMultiSearchMovieResult {
  id: number;
  media_type: 'movie';
  title: string;
  release_date: string;
  vote_average: number;
  poster_path: string | null;
  overview: string;
}

export interface TmdbMultiSearchTvResult {
  id: number;
  media_type: 'tv';
  name: string;
  first_air_date: string;
  vote_average: number;
  poster_path: string | null;
  overview: string;
}

export type TmdbMultiSearchResult =
  | TmdbMultiSearchMovieResult
  | TmdbMultiSearchTvResult;

// Unified match result for UI
export interface TmdbMatchResult {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  year: string;
  rating: number;
  posterUrl: string | null;
  overview: string;
}

// TV Show specific types
export interface TmdbTvShowDetails {
  id: number;
  name: string;
  first_air_date: string;
  vote_average: number;
  number_of_seasons: number;
  number_of_episodes: number;
  poster_path: string | null;
  overview: string;
  genres: Array<{ id: number; name: string }>;
}

export interface TmdbEpisodeDetails {
  id: number;
  name: string;
  episode_number: number;
  season_number: number;
  air_date: string;
  overview: string;
  still_path: string | null;
  vote_average: number;
}

export interface TmdbSeasonDetails {
  id: number;
  _id: string;
  air_date: string;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  vote_average: number;
  episodes: TmdbEpisodeDetails[];
}

export interface TmdbMetadata {
  title: string;
  year?: string;
  tmdbId?: number;
  description?: string;
  show?: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  posterUrl?: string | null;
  type?: 'movie' | 'tv';
}

// --- Resolution Categories ---
export const ResolutionCategory = union([
  literal('4K'),
  literal('1080p'),
  literal('720p'),
  literal('SD'),
  literal('Unknown'),
]);
export type ResolutionCategory = InferOutput<typeof ResolutionCategory>;

// --- Audio Channel Categories ---
export const AudioChannelType = union([
  literal('Mono'),
  literal('Stereo'),
  literal('5.1'),
  literal('7.1'),
  literal('Atmos'),
  literal('Unknown'),
]);
export type AudioChannelType = InferOutput<typeof AudioChannelType>;

// --- Video Stream ---
export const VideoStreamSchema = object({
  index: number(),
  codec: string(),
  width: number(),
  height: number(),
  aspectRatio: optional(string()),
  frameRate: optional(number()),
  bitrate: optional(number()),
  profile: optional(string()),
  resolution: ResolutionCategory,
});
export type VideoStream = InferOutput<typeof VideoStreamSchema>;

// --- Audio Stream ---
export const AudioStreamSchema = object({
  index: number(),
  codec: string(),
  channels: number(),
  channelType: AudioChannelType,
  language: optional(string()),
  title: optional(string()),
  bitrate: optional(number()),
  sampleRate: optional(number()),
  isDefault: optional(literal(true)),
});
export type AudioStream = InferOutput<typeof AudioStreamSchema>;

// --- Subtitle Stream ---
export const SubtitleStreamSchema = object({
  index: number(),
  codec: string(),
  language: optional(string()),
  title: optional(string()),
  isForced: optional(literal(true)),
  isDefault: optional(literal(true)),
});
export type SubtitleStream = InferOutput<typeof SubtitleStreamSchema>;

// --- Path Context (extracted from folder hierarchy during scan) ---
export const PathContextSchema = object({
  showTitle: optional(string()),
  year: optional(string()),
  season: optional(number()),
});
export type PathContext = InferOutput<typeof PathContextSchema>;

// --- Lightweight File (AI scan — no ffprobe data) ---
/**
 * Minimal file descriptor produced by the lightweight AI scanner.
 * Contains only filesystem-level data — no ffprobe stream information.
 * Used exclusively by the AI analysis pipeline.
 */
export interface LightweightFile {
  /** Absolute path to the file */
  path: string;
  /** Basename with extension */
  filename: string;
  /** Lowercase file extension including dot, e.g. ".mkv" */
  extension: string;
  /** File size in bytes from fs.Dirent / fs.stat */
  sizeBytes: number;
  /** mtime in milliseconds */
  modifiedAt: number;
  /** Optional path context derived from folder hierarchy during scan */
  pathContext?: PathContext;
}

// --- Media File ---
export const MediaFileSchema = object({
  id: string(),
  path: string(),
  filename: string(),
  directory: string(),
  extension: string(),
  sizeBytes: number(),
  duration: optional(number()), // seconds
  container: optional(string()),
  bitrate: optional(number()),
  videoStreams: array(VideoStreamSchema),
  audioStreams: array(AudioStreamSchema),
  subtitleStreams: array(SubtitleStreamSchema),
  scannedAt: number(), // Unix timestamp of when file was scanned
  modifiedAt: number(), // Unix timestamp of file's last modification time
  /** Path context derived from folder hierarchy — populated during scan */
  pathContext: optional(PathContextSchema),
  /** AI Analysis State */
  isClean: optional(boolean()),
  suggestedName: optional(string()),
  isIgnored: optional(boolean()),
  analysisResult: optional(string()), // JSON string of AnalysisResult
});
export type MediaFile = InferOutput<typeof MediaFileSchema>;

// --- Scan Progress ---
export const ScanProgressSchema = object({
  status: union([
    literal('idle'),
    literal('scanning'),
    literal('completed'),
    literal('cancelled'),
    literal('error'),
  ]),
  currentFile: optional(string()),
  processedCount: number(),
  totalCount: optional(number()),
  errorCount: number(),
  skippedCount: optional(number()),
  errors: optional(
    array(
      object({
        path: string(),
        error: string(),
      }),
    ),
  ),
  startedAt: optional(number()),
  completedAt: optional(number()),
  errorMessage: optional(string()),
});
export type ScanProgress = InferOutput<typeof ScanProgressSchema>;

// --- Bitrate Ranges for Filter ---
export const BitrateRangeSchema = union([
  literal('Low'),
  literal('Medium'),
  literal('High'),
  literal('Very High'),
]);
export type BitrateRange = InferOutput<typeof BitrateRangeSchema>;

export const CustomBitrateRangeSchema = object({
  minMbps: number(),
  maxMbps: number(),
});
export type CustomBitrateRange = InferOutput<typeof CustomBitrateRangeSchema>;

// --- Filter State ---
export const FilterStateSchema = object({
  resolutions: array(ResolutionCategory),
  audioChannels: array(AudioChannelType),
  audioLanguages: array(string()),
  videoCodecs: array(string()),
  bitrateRanges: optional(array(BitrateRangeSchema)),
  customBitrateRange: optional(CustomBitrateRangeSchema),
  searchQuery: optional(string()),
  sortBy: optional(
    union([
      literal('filename'),
      literal('size'),
      literal('duration'),
      literal('resolution'),
      literal('bitrate'),
      literal('modified'),
      literal('rating'),
    ]),
  ),
  sortDirection: optional(union([literal('asc'), literal('desc')])),
});
export type FilterState = InferOutput<typeof FilterStateSchema>;

// --- Batch Operation Result ---
export const BatchResultSchema = object({
  successCount: number(),
  failedCount: number(),
  errors: array(
    object({
      path: string(),
      error: string(),
    }),
  ),
});
export type BatchResult = InferOutput<typeof BatchResultSchema>;

// --- Bitrate Thresholds ---
export const BITRATE_THRESHOLDS = {
  Low: { min: 0, max: 2000000, label: 'Low (< 2 Mbps)' }, // < 2 Mbps
  Medium: { min: 2000000, max: 5000000, label: 'Medium (2-5 Mbps)' }, // 2-5 Mbps
  High: { min: 5000000, max: 15000000, label: 'High (5-15 Mbps)' }, // 5-15 Mbps
  'Very High': { min: 15000000, max: Infinity, label: 'Very High (> 15 Mbps)' }, // > 15 Mbps
};

// --- OMDB Ratings ---
export const OmdbRatingSchema = object({
  imdbID: string(),
  Title: string(),
  Year: string(),
  Rated: string(),
  Released: string(),
  Runtime: string(),
  Genre: string(),
  Director: string(),
  Writer: string(),
  Actors: string(),
  Plot: string(),
  Language: string(),
  Country: string(),
  Awards: string(),
  Poster: string(),
  Ratings: array(
    object({
      Source: string(),
      Value: string(),
    }),
  ),
  Metascore: string(),
  imdbRating: string(),
  imdbVotes: string(),
  Type: string(),
  DVD: string(),
  BoxOffice: string(),
  Production: string(),
  Website: string(),
  Response: string(),
  fetchedAt: number(), // Unix timestamp
  notFound: optional(literal(true)), // True if movie was not found in API
  searchedTitle: optional(string()), // The title that was searched for (for user to correct)
});
export type OmdbRating = InferOutput<typeof OmdbRatingSchema>;

export const RatingsCacheSchema = object({
  ratings: string(), // JSON stringified map of [searchKey: string]: OmdbRating
});
export type RatingsCache = InferOutput<typeof RatingsCacheSchema>;

// --- App Settings ---
export const ThemeSchema = union([literal('dark'), literal('light')]);
export type Theme = InferOutput<typeof ThemeSchema>;

export const RatingProviderSchema = union([literal('omdb'), literal('tmdb')]);
export type RatingProvider = InferOutput<typeof RatingProviderSchema>;

export const AppSettingsSchema = object({
  theme: ThemeSchema,
  language: string(),
  alwaysDeleteEnclosingFolder: optional(literal(true)),
  omdbApiKey: optional(string()),
  tmdbApiKey: optional(string()),
  ratingProvider: optional(RatingProviderSchema),
  vlcPath: optional(string()),
  /**
   * When true, applyFix will move TV episode files into
   * `{scanRoot}/Show (Year)/Season N/` folder hierarchy.
   */
  organizeSeriesIntoFolders: optional(boolean()),
  /**
   * When true, completely clean seasons will be hidden from the Season View.
   */
  hideCleanedSeasons: optional(boolean()),
});
export type AppSettings = InferOutput<typeof AppSettingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'en',
  alwaysDeleteEnclosingFolder: undefined,
  omdbApiKey: '',
  tmdbApiKey: '',
  ratingProvider: 'omdb',
  vlcPath: '',
  organizeSeriesIntoFolders: undefined,
  hideCleanedSeasons: undefined,
};

// --- Storage Schema ---
export const StorageSchema = object({
  mediaLibrary: array(MediaFileSchema),
  lastScanPath: nullable(string()),
  lastScanAt: nullable(number()),
  filters: optional(FilterStateSchema),
  settings: optional(AppSettingsSchema),
});
export type StorageData = InferOutput<typeof StorageSchema> & {
  aiSettings?: AISettings;
};

// --- Utility Functions ---
export function categorizeResolution(
  width: number,
  height: number,
): ResolutionCategory {
  const pixels = Math.max(width, height);
  if (pixels >= 2160) return '4K';
  if (pixels >= 1080) return '1080p';
  if (pixels >= 720) return '720p';
  if (pixels > 0) return 'SD';
  return 'Unknown';
}

export function categorizeChannels(
  channels: number,
  codec?: string,
): AudioChannelType {
  // Check for Atmos (usually comes with Dolby Digital Plus or TrueHD)
  if (
    codec &&
    (codec.toLowerCase().includes('atmos') ||
      codec.toLowerCase().includes('truehd'))
  ) {
    if (channels >= 6) return 'Atmos';
  }

  if (channels >= 8) return '7.1';
  if (channels >= 6) return '5.1';
  if (channels === 2) return 'Stereo';
  if (channels === 1) return 'Mono';
  return 'Unknown';
}

// --- Supported File Extensions ---
export const SUPPORTED_EXTENSIONS = [
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
  '.divx',
];

export function isSupportedMediaFile(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return SUPPORTED_EXTENSIONS.includes(ext);
}

// --- Optimization State ---
export const OptimizationStateSchema = object({
  version: number(),
  lastScan: number(),
  files: array(
    object({
      path: string(),
      isClean: boolean(),
      lastModified: number(),
      isIgnored: optional(boolean()),
    }),
  ),
});
export type OptimizationState = InferOutput<typeof OptimizationStateSchema>;

/**
 * Sanitizes a string for use as a single folder or file name.
 * Removes illegal characters, collapses spaces, and trims.
 */
export function sanitizePathSegment(segment: string): string {
  if (!segment) return '';

  return (
    segment
      // Replace colons with spaces (better for titles like "Mission: Impossible")
      .replace(/:/g, ' ')
      // Replace illegal characters with spaces (more aggressive: keep only alphanumeric, spaces, dots, dashes, underscores, apostrophes, ampersands, exclamation marks, and commas)
      .replace(/[^a-zA-Z0-9\s.\-_()[\]'&!,]/g, ' ')
      // Collapse multiple spaces
      .replace(/\s+/g, ' ')
      // Collapse multiple dashes surrounded by spaces into a single dash
      .replace(/\s+-\s+-\s+/g, ' - ')
      // Ensure no trailing space before extension (caller handles ext, but here we trim)
      .replace(/^[\s.]+|[\s.]+$/g, '')
      .trim()
  );
}
// --- Task Queue Types ---
export type TaskStatus = 'pending' | 'processing' | 'success' | 'error';

export interface QueueTask {
  id: string;
  type: string;
  payload: unknown;
  status: TaskStatus;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// --- Cleaner Types ---
export interface CleanerResultItem {
  type: 'file' | 'folder';
  path: string;
  sizeBytes?: number;
  filename?: string;
}
