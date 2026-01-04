import { array, InferOutput, literal, nullable, number, object, optional, string, union } from 'valibot';

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
  scannedAt: number(), // Unix timestamp
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
  errors: optional(array(object({
    path: string(),
    error: string(),
  }))),
  startedAt: optional(number()),
  completedAt: optional(number()),
  errorMessage: optional(string()),
});
export type ScanProgress = InferOutput<typeof ScanProgressSchema>;

// --- Filter State ---
export const FilterStateSchema = object({
  resolutions: array(ResolutionCategory),
  audioChannels: array(AudioChannelType),
  audioLanguages: array(string()),
  videoCodecs: array(string()),
  searchQuery: optional(string()),
  sortBy: optional(union([
    literal('filename'),
    literal('size'),
    literal('duration'),
    literal('resolution'),
    literal('bitrate'),
  ])),
  sortDirection: optional(union([literal('asc'), literal('desc')])),
});
export type FilterState = InferOutput<typeof FilterStateSchema>;

// --- Batch Operation Result ---
export const BatchResultSchema = object({
  successCount: number(),
  failedCount: number(),
  errors: array(object({
    path: string(),
    error: string(),
  })),
});
export type BatchResult = InferOutput<typeof BatchResultSchema>;

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
  Ratings: array(object({
    Source: string(),
    Value: string(),
  })),
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
});
export type AppSettings = InferOutput<typeof AppSettingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'en',
  alwaysDeleteEnclosingFolder: undefined,
  omdbApiKey: '',
  tmdbApiKey: '',
  ratingProvider: 'omdb',
};

// --- Storage Schema ---
export const StorageSchema = object({
  mediaLibrary: array(MediaFileSchema),
  lastScanPath: nullable(string()),
  lastScanAt: nullable(number()),
  filters: optional(FilterStateSchema),
  settings: optional(AppSettingsSchema),
});
export type StorageData = InferOutput<typeof StorageSchema>;

// --- Utility Functions ---
export function categorizeResolution(width: number, height: number): ResolutionCategory {
  const pixels = Math.max(width, height);
  if (pixels >= 2160) return '4K';
  if (pixels >= 1080) return '1080p';
  if (pixels >= 720) return '720p';
  if (pixels > 0) return 'SD';
  return 'Unknown';
}

export function categorizeChannels(channels: number, codec?: string): AudioChannelType {
  // Check for Atmos (usually comes with Dolby Digital Plus or TrueHD)
  if (codec && (codec.toLowerCase().includes('atmos') || codec.toLowerCase().includes('truehd'))) {
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
  '.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
  '.m4v', '.mpg', '.mpeg', '.ts', '.m2ts', '.vob', '.divx',
];

export function isSupportedMediaFile(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return SUPPORTED_EXTENSIONS.includes(ext);
}
