import {
  AnalysisResult,
  LightweightFile,
  PathContext,
  TmdbMatchResult,
} from '@medularity/archivist-core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AIService } from './ai.service';
import { embedMetadata } from './ffmpeg-metadata.service';
import {
  cleanupEmptyFolder,
  moveRemainingFiles,
  renameFileWithSubtitles,
} from './file-operations.service';

import { DatabaseService } from './database.service';
import { OptimizationStateService } from './optimization-state.service';
import { getAISettings, getLastScanPath, getSettings } from './storage.service';
import { TmdbService } from './tmdb.service';

const MAX_MATCHES = 100;
let cancelRequested = false;

// Pre-compiled once at module load — not rebuilt on every cleanFilename call
const RELEASE_TAGS: RegExp[] = [
  /\b1080p\b/gi,
  /\b720p\b/gi,
  /\b2160p\b/gi,
  /\b4k\b/gi,
  /\bx264\b/gi,
  /\bx265\b/gi,
  /\bh264\b/gi,
  /\bh265\b/gi,
  /\bhevc\b/gi,
  /\bweb-dl\b/gi,
  /\bwebrip\b/gi,
  /\bbluray\b/gi,
  /\bdvdrip\b/gi,
  /\bhdtv\b/gi,
  /\baac\b/gi,
  /\bac3\b/gi,
  /\beac3\b/gi,
  /\bdts\b/gi,
  /\btruehd\b/gi,
  /\batmos\b/gi,
  /\bhdr\b/gi,
  /\bhdr10\b/gi,
  /\bdv\b/gi, // dolby vision
  /\b10bit\b/gi,
  /\b5\.1\b/g,
  /\b7\.1\b/g,
  /\brepack\b/gi,
  /\bproper\b/gi,
  /\bextended\b/gi,
  /\bdirectors cut\b/gi,
  /\bmulti\b/gi,
  /\bsub\b/gi,
  /\bdub\b/gi,
  /\b(german|english|swedish|french|spanish|italian|nordic|pal|ntsc)\b/gi,
  /\b(dl|internal|readnfo|retail|complete|remastered|limited|unrated)\b/gi,
  /\b(web|web-dl|webrip|bdrip|brrip|dvd|dvdr|dvdrip|hdtv)\b/gi,
  /\b(x264|x265|h264|h265|hevc|av1)\b/gi,
  /\b(aac|ac3|eac3|dts|dts-hd|truehd|atmos|flac)\b/gi,
  /\[.*?\]/g, // brackets
  /\((?!(?:19|20)\d{2}\)).*?\)/g, // parentheses — but preserve (YEAR) like (2023)
  /\bS\d{1,2}\s*E\d{1,3}\b/gi, // S01E01 or S01 E01
  /\b\d{1,2}x\d{2,3}\b/gi, // 1x01
  /\bSeason\s*\d{1,2}\b/gi,
  /\bEpisode\s*\d{1,3}\b/gi,
];

/**
 * Detected season/episode info from filename or folder context.
 */
export interface EpisodeInfo {
  season: number;
  episodes: number[];
  rawMatch: string;
}

export interface SeriesFileGroup {
  showKey: string;
  files: LightweightFile[];
}

export const AnalysisService = {
  requestCancelAnalysis(): void {
    cancelRequested = true;
  },
  cleanFilename(filename: string): string {
    const ext = path.extname(filename);
    let clean = path.basename(filename, ext).replace(/[._]/g, ' ');

    for (const tag of RELEASE_TAGS) {
      clean = clean.replace(tag, '');
    }

    return clean.replace(/\s+/g, ' ').trim();
  },
  /**
   * Specifically for TMDB search: remove the year from a cleaned filename.
   */
  prepareSearchQuery(filename: string): string {
    const cleaned = this.cleanFilename(filename);
    const yearMatch = cleaned.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      return cleaned.replace(yearMatch[0], '').replace(/\s+/g, ' ').trim();
    }
    return cleaned;
  },
  detectEpisodeInfo(filename: string, parentDir: string): EpisodeInfo | null {
    const combined = `${filename} ${parentDir}`;
    let episodes: number[] = [];
    let season: number | null = null;
    let rawMatch = '';

    // Detect season folder context early for fallbacks
    const seasonFolder =
      parentDir.match(/[Ss]eason\s*(\d{1,2})|[Ss]aison\s*(\d{1,2})/i) ||
      parentDir.match(/\b[Ss](\d{1,2})\b/);

    // --- Search Patterns ---

    // 1. SxxExx (multi-support: S01E01E02, S01E01-E02, S01E01 E02)
    const sxxexxMatches = Array.from(
      combined.matchAll(
        /[Ss](\d{1,2})\s*(?:[Ee](\d{1,3})(?:\s*[Ee-]\s*(\d{1,3}))?)/gi,
      ),
    );

    if (sxxexxMatches.length > 0) {
      season = parseInt(sxxexxMatches[0][1], 10);
      rawMatch = sxxexxMatches[0][0];
      for (const m of sxxexxMatches) {
        if (m[2]) episodes.push(parseInt(m[2], 10));
        if (m[3]) episodes.push(parseInt(m[3], 10));
      }
    }

    // 2. NxNN (e.g. 1x03, 01 x 01)
    if (episodes.length === 0) {
      const nxnn = combined.match(/\b(\d{1,2})\s*[xX]\s*(\d{2,3})\b/);
      if (nxnn) {
        season = parseInt(nxnn[1], 10);
        episodes = [parseInt(nxnn[2], 10)];
        rawMatch = nxnn[0];
      }
    }

    // 3. SxxEyy shorthand (e.g. 208, 1105, S208)
    if (episodes.length === 0) {
      const shorthand = combined.match(/\b([Ss])?(\d{1,2})(\d{2})\b/i);
      if (shorthand) {
        const hasExplicitS = !!shorthand[1];
        const s = parseInt(shorthand[2], 10);
        const e = parseInt(shorthand[3], 10);

        if (hasExplicitS || (s > 0 && s <= 30 && e > 0 && e <= 50)) {
          season = s;
          episodes = [e];
          rawMatch = shorthand[0];
        }
      }
    }

    // 4. Standalone Ep (e.g. Ep 03, Episode 12)
    if (episodes.length === 0) {
      const standaloneEp = combined.match(
        /\b(?:[Ee]pisode|[Ee]p\.?)\s*(\d{1,3})\b/i,
      );
      if (standaloneEp) {
        season = seasonFolder
          ? parseInt(seasonFolder[1] ?? seasonFolder[2], 10)
          : 1;
        episodes = [parseInt(standaloneEp[1], 10)];
        rawMatch = standaloneEp[0];
      }
    }

    // 5. Fallback: separator-gated number
    if (episodes.length === 0 && seasonFolder) {
      season = parseInt(seasonFolder[1] || seasonFolder[2], 10);
      const afterSep = filename.match(
        /[-_.\s]+(\d{1,3})(?!\d)(?!\s*(?:19|20)\d{2})/i,
      );
      if (afterSep) {
        episodes = [parseInt(afterSep[1], 10)];
        rawMatch = afterSep[0].trim();
      }
    }

    if (season !== null && episodes.length > 0) {
      const result: EpisodeInfo = {
        season,
        episodes: Array.from(new Set(episodes)), // Deduplicate
        rawMatch,
      };
      console.log(
        `[AnalysisService] detectEpisodeInfo for "${filename}": S${result.season}E[${result.episodes.join(',')}]`,
      );
      return result;
    }

    console.log(`[AnalysisService] detectEpisodeInfo for "${filename}": NULL`);
    return null;
  },
  /**
   * Extract title and year from a messy filename when TMDB fails
   */
  generateTitleExtractionPrompt(filename: string, parentDir: string): string {
    return `
          You are a media file analyzer.
          The following filename could not be matched in a database due to scene tags, obfuscation, or bad formatting, possibly different language (original title).
          Extract the core title (in English) and year of the movie or TV show.
 
          File Information:
          - Filename: "${filename}"
          - Parent Directory: "${parentDir}"
 
          Return ONLY valid JSON with this schema:
          {
            "title": string,
            "year": string, // YYYY (optional if not present)
            "type": "movie" | "tv" | "unknown"
          }
          `;
  },
  /**
   * Identifies the logical root directory of a TV show based on season/episode folder heuristics.
   */
  getShowRootDirectory(filePath: string): string {
    const parts = filePath.split(path.sep);
    // Ignore the filename itself, look up to 7 folders up
    const maxDepth = Math.max(0, parts.length - 7);

    for (let i = parts.length - 2; i >= maxDepth; i--) {
      const part = parts[i];
      if (!part) continue;

      // Pattern 1: explicit "Season X" / "Saison X" / "S X" folder
      if (part.match(/^(?:[Ss]eason|[Ss]aison|[Ss])\s*(\d{1,2})$/i)) {
        return parts.slice(0, i).join(path.sep);
      }

      // Pattern 2: episode-named folder (e.g. "Show.S01E03.HDTV.x264")
      if (part.match(/[Ss](\d{1,2})[\s.]*[Ee](\d{1,3})/i)) {
        return parts.slice(0, i).join(path.sep);
      }
    }

    // Default to immediate parent
    return path.dirname(filePath);
  },
  /**
   * Determines if a folder name safely isolates a specific TV show.
   */
  isIsolatedShowFolder(showRoot: string, showKey: string): boolean {
    const rootName = this.cleanFilename(path.basename(showRoot)).toLowerCase();
    const key = showKey.toLowerCase();

    if (rootName === key) return true;
    if (rootName.includes(key) || key.includes(rootName)) return true;
    if (rootName.replace(/\s/g, '') === key.replace(/\s/g, '')) return true;

    return false;
  },
  /**
   * Run analysis on a list of files using a live queue.
   *
   * Algorithm:
   *   1. Pop a file from the front of the queue.
   *   2. If it looks like a TV episode (SxxExx / parent-season folder), derive
   *      a show key and collect ALL other files with the same show key from the
   *      remaining queue, then batch-analyse them as a group.
   *   3. Otherwise treat it as a movie and analyse it individually.
   *
   * This ensures each file is processed exactly once with no upfront grouping.
   */
  async runAnalysis(
    files: LightweightFile[],
    filter: 'both' | 'movie' | 'tv',
    onProgress: (result: AnalysisResult) => void,
  ): Promise<void> {
    console.log('[AnalysisService] Running analysis on', files.length, 'files');

    cancelRequested = false;
    const settings = await getSettings();
    const apiKey = settings.tmdbApiKey;

    if (!apiKey)
      console.warn(
        '[AnalysisService] TMDB API key not set, falling back to basic analysis.',
      );

    const queue: LightweightFile[] = [...files];

    while (queue.length > 0) {
      if (cancelRequested) {
        console.log('[AnalysisService] Analysis cancelled');
        return;
      }

      const file = queue.shift()!;
      if (!file) continue; // Should not happen with queue.length > 0, but good for type safety

      const filename = path.basename(file.path);
      const parentDir = path.basename(path.dirname(file.path));

      // Determine show key — either from scanner pathContext or filename detection
      let showKey = this.deriveShowKey(filename, parentDir, file.pathContext);

      // Force movie treatment if filter is strictly 'movie'
      if (filter === 'movie') {
        showKey = null;
      }

      console.log(`[AnalysisService] Popped: ${filename}, ShowKey: ${showKey}`);

      if (showKey !== null) {
        // TV episode branch — collect all files for this show from the queue
        const showFiles: LightweightFile[] = [file];
        const showRoot = this.getShowRootDirectory(file.path);
        const isIsolated = this.isIsolatedShowFolder(showRoot, showKey);

        console.log(
          `[AnalysisService] ShowRoot: ${showRoot}, IsIsolated: ${isIsolated}`,
        );

        let i = 0;
        while (i < queue.length) {
          const candidate = queue[i]!;
          const candidateFilename = path.basename(candidate.path);
          const candidateParentDir = path.basename(
            path.dirname(candidate.path),
          );
          const candidateKey = this.deriveShowKey(
            candidateFilename,
            candidateParentDir,
            candidate.pathContext,
          );

          let isSameFolder = false;
          if (isIsolated) {
            const candidateShowRoot = this.getShowRootDirectory(candidate.path);
            if (candidateShowRoot === showRoot) {
              isSameFolder = true;
            }
          }

          if (candidateKey === showKey || isSameFolder) {
            console.log(
              `[AnalysisService] Grouping: ${candidateFilename} with ${showKey} (SameKey: ${candidateKey === showKey}, SameFolder: ${isSameFolder})`,
            );
            showFiles.push(candidate);
            queue.splice(i, 1); // remove from queue
          } else {
            i++;
          }
        }

        console.log(
          `[AnalysisService] Analyzing series group "${showKey}" with ${showFiles.length} files`,
        );

        try {
          await this.analyzeSeriesGroup(
            { showKey, files: showFiles },
            apiKey || '',
            onProgress,
          );
        } catch (err) {
          console.error(
            `[AnalysisService] Series group "${showKey}" failed:`,
            err,
          );
          // Fallback: analyse each file individually
          for (const f of showFiles) {
            if (cancelRequested) return;
            try {
              onProgress(await this.analyzeFile(f));
            } catch (e) {
              console.error(
                `[AnalysisService] Fallback failed for ${f.path}:`,
                e,
              );
            }
          }
        }
      } else {
        // Movie (or individual TV) branch — analyse individually
        // If filter is 'tv' but we didn't find a show group, we still analyse it as TV individually
        // if forced.

        console.log(`[AnalysisService] Analyzing individual file: ${filename}`);
        try {
          onProgress(
            await this.analyzeFile(
              file,
              filter === 'both' ? undefined : filter,
            ),
          );
        } catch (e) {
          console.error(
            `[AnalysisService] File analysis failed for ${file.path}:`,
            e,
          );
        }
      }
    }
  },

  /**
   * Derive a normalised show key from a filename + parent dir + optional pathContext.
   * Returns null if the file does not appear to be a TV episode.
   */
  deriveShowKey(
    filename: string,
    parentDir: string,
    pathContext?: PathContext,
  ): string | null {
    // 1. PathContext from scanner (establish canonical key)
    if (pathContext?.showTitle) {
      // Force space normalization (dots/underscores to spaces) to ensure alignment
      // with filename-extracted titles.
      const normalizedContextTitle = pathContext.showTitle
        .replace(/[._]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return normalizedContextTitle.toLowerCase();
    }

    // 2. Detect episode info from filename / parent dir
    const epInfo = this.detectEpisodeInfo(filename, parentDir);
    if (!epInfo) return null;

    const lowerName = filename.toLowerCase();
    const lowerMatch = epInfo.rawMatch.toLowerCase();
    const epMatchIndex = lowerName.indexOf(lowerMatch);

    let extractedTitle = lowerName;
    if (epMatchIndex > 0) {
      // Must be at least 1 character before the ep match
      extractedTitle = lowerName.substring(0, epMatchIndex).trim();
    } else if (epMatchIndex === 0) {
      // Ep pattern at the start? Likely a bad match or file named "Ep 03.mp4"
      extractedTitle = lowerName;
    } else {
      // If we have epInfo but index failed (e.g. mismatched separators), try a loose split
      // Added lookbehind-ish check: don't split if the number is at the very start (e.g. "2 Broke Girls")
      const splitParts = lowerName.split(/\s+-\s*|\s+\d{3,4}(?!\d)|(\s+s\d+)/i);
      extractedTitle = splitParts[0]!;
    }

    // Final secondary clean — remove any trailing "Season X" or separators
    extractedTitle = extractedTitle
      .replace(/[\s.-]+(season|s)\s*\d+$/i, '')
      .replace(/[\s.-]+$/, '')
      .trim();

    // Final secondary clean
    extractedTitle = this.cleanFilename(extractedTitle);
    const resultKey = extractedTitle.toLowerCase() || null;
    console.log(
      `[AnalysisService] deriveShowKey: "${filename}" -> "${resultKey}" (PathCtx: ${pathContext?.showTitle || 'none'})`,
    );
    return resultKey;
  },

  /**
   * Analyze a group of files belonging to the same series
   */
  async analyzeSeriesGroup(
    group: SeriesFileGroup,
    apiKey: string,
    onProgress: (result: AnalysisResult) => void,
  ): Promise<void> {
    if (group.files.length === 0) return;

    console.log(
      `[AnalysisService] Analyzing series group: ${group.showKey} (${group.files.length} files)`,
    );

    if (!apiKey) {
      // Fallback to individual analysis if no API key
      for (const file of group.files) {
        if (cancelRequested) break;
        onProgress(await this.analyzeFile(file));
      }
      return;
    }

    // 1. Pick a representative file for show lookup
    const repFile = group.files[0]!;
    const repFilename = path.basename(repFile.path);
    const repClean = this.cleanFilename(repFilename);

    // 2. Search for the show with potential LLM pre-cleaning
    const aiSettings = await getAISettings();
    const targetYear =
      this.extractYear(repFilename) ||
      this.extractYear(path.basename(path.dirname(repFile.path)));
    let searchTerm = this.prepareSearchQuery(group.showKey);
    let tmdbResults = await TmdbService.searchMulti(searchTerm, apiKey);

    if (targetYear) {
      tmdbResults = this.prioritizeMatches(
        tmdbResults,
        targetYear,
        repFilename,
      );
    }

    // If no results or low confidence, try AI extraction for better search term
    if (tmdbResults.length === 0 || tmdbResults[0].type !== 'tv') {
      console.log(
        `[AnalysisService] Series group lookup low confidence for "${searchTerm}", triggering LLM extraction.`,
      );
      const extractionPrompt = this.generateTitleExtractionPrompt(
        path.basename(repFile.path),
        path.basename(path.dirname(repFile.path)),
      );

      const extractionResponse = await AIService.generate(aiSettings, {
        prompt: extractionPrompt,
        systemPrompt:
          'You are a JSON-only API. return ONLY raw JSON, no markdown formatting.',
      });

      if (!extractionResponse.error) {
        try {
          const jsonText = extractionResponse.text
            .trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          const extracted = JSON.parse(jsonText);

          if (extracted.title) {
            searchTerm = extracted.title;
            const yearMatch = extracted.year ? ` ${extracted.year}` : '';
            console.log(
              `[AnalysisService] LLM Extracted Group Title: "${searchTerm}"`,
            );
            tmdbResults = await TmdbService.searchMulti(searchTerm, apiKey);
          }
        } catch (e) {
          console.warn('[AnalysisService] Group LLM extraction failed:', e);
        }
      }
    }

    const tvMatch = tmdbResults.find((r) => r.type === 'tv') || tmdbResults[0];

    if (!tvMatch || tvMatch.type !== 'tv') {
      // Not a TV show or no match — fall back to individual analysis
      for (const file of group.files) {
        onProgress(await this.analyzeFile(file));
      }
      return;
    }

    // 3. Get canonical show details
    const showDetails = await TmdbService.getTvShowDetails(tvMatch.id, apiKey);

    console.log('[AnalysisService] Canonical show match:', showDetails?.name);
    const canonicalTitle = showDetails?.name || tvMatch.title;
    const canonicalYear = showDetails?.first_air_date
      ? showDetails.first_air_date.substring(0, 4)
      : tvMatch.year;

    // 4. Group files by season — store resolved epInfo alongside file to avoid re-detection
    const filesBySeason = new Map<
      number,
      { file: LightweightFile; epInfo: EpisodeInfo }[]
    >();
    let epInfoCount = 0;
    for (const file of group.files) {
      const filename = path.basename(file.path);
      const parentDir = path.basename(path.dirname(file.path));
      let epInfo = this.detectEpisodeInfo(filename, parentDir);

      // PathContext Fallback — use separator-gated match only, never grab the first number blindly
      if (!epInfo && file.pathContext?.season !== undefined) {
        const afterSep = filename.match(
          /[-_.\s]+(\d{1,3})(?!\d)(?!\s*(?:19|20)\d{2})/,
        );
        if (afterSep) {
          epInfo = {
            season: file.pathContext.season,
            episodes: [parseInt(afterSep[1], 10)],
            rawMatch: 'Scanner PathContext Fallback (separator-gated)',
          };
        }
      }

      if (epInfo) {
        console.log(
          `[AnalysisService] Group match: ${filename} -> S${epInfo.season}E[${epInfo.episodes.join(',')}]`,
        );
        epInfoCount++;
        if (!filesBySeason.has(epInfo.season)) {
          filesBySeason.set(epInfo.season, []);
        }
        filesBySeason.get(epInfo.season)!.push({ file, epInfo });
      } else {
        console.log(
          `[AnalysisService] Episode info failed for: ${filename} (Parent: ${parentDir}). Individually analyzing...`,
        );
        const individual = await this.analyzeFile(file);
        if (
          individual.metadata?.type === 'tv' &&
          individual.metadata.episode &&
          individual.metadata.tmdbId === tvMatch.id
        ) {
          const s = individual.metadata.season || 1;
          const e = individual.metadata.episode;
          console.log(
            `[AnalysisService] Case deduplication: ${filename} matched individually as S${s}E${e}. Registering as found for batch.`,
          );
          if (!filesBySeason.has(s)) {
            filesBySeason.set(s, []);
          }
          filesBySeason.get(s)!.push({
            file,
            epInfo: {
              season: s,
              episodes: [e],
              rawMatch: 'Individual Fallback Match',
            },
          });
          epInfoCount++;
          // DO NOT call onProgress(individual) here — the batch loop below will handle it
          // with the correct seriesRoot and formatting.
        } else {
          // Different show or movie — emit individually now
          onProgress(individual);
        }
      }
    }

    console.log(
      `[AnalysisService] Season mapping for "${group.showKey}":`,
      Array.from(filesBySeason.entries())
        .map(([s, files]) => `Season ${s}: ${files.length} files`)
        .join(', '),
    );

    console.log(
      `[AnalysisService] Group episodes detected: ${epInfoCount}/${group.files.length} files`,
    );

    // 4b. Detect missing seasons — seasons present in TMDB but with no local files
    const { sanitizePathSegment: sanitize } =
      await import('@medularity/archivist-core');
    const sanitizedTitleForMissing = sanitize(canonicalTitle);
    const showFolderForMissing = sanitize(
      `${sanitizedTitleForMissing}${canonicalYear ? ` (${canonicalYear})` : ''}`,
    );
    const totalSeasons = showDetails?.number_of_seasons ?? 0;
    const presentSeasons = new Set(filesBySeason.keys());

    for (let s = 1; s <= totalSeasons; s++) {
      if (!presentSeasons.has(s)) {
        const missingSeasonResult: AnalysisResult = {
          filePath: `missing://${tvMatch.id}/${s}`,
          originalName: '[MISSING SEASON]',
          suggestedName: `${sanitizedTitleForMissing} - Season ${s}.missing`,
          isClean: false,
          isMissing: true,
          score: 0,
          reason: 'Missing Season',
          seriesRoot: path.join(showFolderForMissing, `Season ${s}`),
          metadata: {
            title: canonicalTitle,
            year: canonicalYear || '',
            season: s,
            episode: 0,
            tmdbId: tvMatch.id,
            posterUrl: tvMatch.posterUrl,
            type: 'tv',
          },
        };
        onProgress(missingSeasonResult);
      }
    }

    // 5. Process each season
    for (const [seasonNum, seasonFiles] of filesBySeason.entries()) {
      if (cancelRequested) break;
      try {
        const seasonDetails = await TmdbService.getSeasonDetails(
          tvMatch.id,
          seasonNum,
          apiKey,
        );

        console.log(
          `[AnalysisService] Processing season details for ${canonicalTitle} Season ${seasonNum}`,
        );

        if (!seasonDetails) {
          // Fallback to individual analysis if season details fail
          for (const { file } of seasonFiles) {
            onProgress(await this.analyzeFile(file));
          }
          continue;
        }

        const { sanitizePathSegment } =
          await import('@medularity/archivist-core');
        const sanitizedCanonicalTitle = sanitizePathSegment(canonicalTitle);
        const showFolder = sanitizePathSegment(
          `${sanitizedCanonicalTitle}${canonicalYear ? ` (${canonicalYear})` : ''}`,
        );
        const seriesRoot = path.join(showFolder, `Season ${seasonNum}`);

        // Track found episodes to detect missing ones
        const foundEpisodes = new Set<number>();

        // Process found files — use stored epInfo, never re-detect
        for (const { file, epInfo } of seasonFiles) {
          if (cancelRequested) break;
          const filename = path.basename(file.path);

          // Track ALL episodes in this file for deduplication
          for (const epNum of epInfo.episodes) {
            foundEpisodes.add(Number(epNum));
          }

          const primaryEp = epInfo.episodes[0];
          const epDetails = seasonDetails.episodes.find(
            (e) => e.episode_number === primaryEp,
          );

          const episodeTitle = epDetails?.name
            ? sanitizePathSegment(epDetails.name)
            : undefined;

          // S-Code: show multi episodes if detected, e.g. S01E01-E02
          let sCode = `S${seasonNum.toString().padStart(2, '0')}`;
          if (epInfo.episodes.length > 1) {
            sCode += epInfo.episodes
              .map((e) => `E${e.toString().padStart(2, '0')}`)
              .join('-');
          } else {
            sCode += `E${primaryEp.toString().padStart(2, '0')}`;
          }

          const ext = path.extname(filename);

          let baseName = '';
          if (episodeTitle) {
            baseName = sanitizePathSegment(
              `${sanitizedCanonicalTitle} - ${sCode} - ${episodeTitle}`,
            );
          } else {
            baseName = sanitizePathSegment(
              `${sanitizedCanonicalTitle} - ${sCode}`,
            );
          }
          const suggestedName = `${baseName}${ext}`;

          const result: AnalysisResult = {
            filePath: file.path,
            originalName: filename,
            suggestedName,
            isClean: filename === suggestedName,
            score: 1.0,
            reason: 'Deterministic Series Match (TMDB Season Batch)',
            seriesRoot,
            metadata: {
              title: canonicalTitle,
              year: canonicalYear || '',
              season: seasonNum,
              episode: primaryEp,
              episodeTitle,
              tmdbId: tvMatch.id,
              posterUrl: tvMatch.posterUrl,
              type: 'tv',
            },
            matches: [tvMatch],
            sizeBytes: file.sizeBytes,
          };

          console.log(
            `[AnalysisService] Emitting result for ${sCode}: ${suggestedName} (File: ${file.path})`,
          );
          onProgress(result);
        }

        // Detect missing episodes
        const airedEpisodes = seasonDetails.episodes.filter((e) => {
          if (!e.air_date) return true; // Assume aired if no date
          return new Date(e.air_date) <= new Date();
        });

        console.log(
          `[AnalysisService] Season ${seasonNum} Missing Detection Prep:`,
          `FoundEpisodes: [${Array.from(foundEpisodes)
            .sort((a, b) => a - b)
            .join(', ')}]`,
          `AiredEpisodes: [${airedEpisodes.map((e) => e.episode_number).join(', ')}]`,
        );

        for (const ep of airedEpisodes) {
          if (!foundEpisodes.has(Number(ep.episode_number))) {
            const sCode = `S${seasonNum.toString().padStart(2, '0')}E${ep.episode_number.toString().padStart(2, '0')}`;
            const sanitizedEpName = ep.name ? sanitizePathSegment(ep.name) : '';
            const missingSuggested = ep.name
              ? `${sanitizedCanonicalTitle} - ${sCode} - ${sanitizedEpName}.missing`
              : `${sanitizedCanonicalTitle} - ${sCode}.missing`;

            const missingResult: AnalysisResult = {
              filePath: `missing://${tvMatch.id}/${seasonNum}/${ep.episode_number}`,
              originalName: '[MISSING]',
              suggestedName: missingSuggested,
              isClean: false,
              isMissing: true,
              score: 0,
              reason: 'Missing Episode',
              seriesRoot,
              metadata: {
                title: canonicalTitle,
                year: canonicalYear || '',
                season: seasonNum,
                episode: ep.episode_number,
                episodeTitle: sanitizedEpName,
                tmdbId: tvMatch.id,
                posterUrl: tvMatch.posterUrl,
                type: 'tv',
              },
            };
            console.log(
              `[AnalysisService] Emitting MISSING for S${seasonNum}E${ep.episode_number}: ${missingSuggested}`,
            );
            onProgress(missingResult);
          }
        }
      } catch (err) {
        console.error(
          `[AnalysisService] Season ${seasonNum} batch processing failed:`,
          err,
        );
        // Fallback for this season's files
        for (const { file } of seasonFiles) {
          if (cancelRequested) break;
          onProgress(await this.analyzeFile(file));
        }
      }
    }
  },
  async isCleanedFile(
    filePath: string,
    rootPath: string,
    filename: string,
    cleanFilename: string,
    sizeBytes: number,
  ): Promise<AnalysisResult | null> {
    // 0. Check Local Optimization State
    try {
      const stats = await fs.stat(filePath);
      const isKnownClean = await OptimizationStateService.isFileClean(
        rootPath || path.dirname(filePath),
        filePath,
        stats.mtimeMs,
      );

      if (isKnownClean) {
        return {
          filePath,
          originalName: filename,
          suggestedName: filename,
          isClean: true,
          score: 1,
          sizeBytes,
          reason: 'Cached State (optimize.archivist)',
          metadata: {
            title: cleanFilename,
            year: this.extractYear(filename) ?? '',
          },
        };
      } else {
        return null;
      }
    } catch (e) {
      console.warn('Failed to check optimization state:', e);
      return null;
    }
  },
  /**
   * Analyze a single file
   */
  async analyzeFile(
    file: LightweightFile,
    forcedType?: 'movie' | 'tv',
  ): Promise<AnalysisResult> {
    // Prepare variables
    const filePath = file.path;
    const pathContext = file.pathContext;
    const filename = path.basename(filePath);
    const parentDir = path.basename(path.dirname(filePath));

    const [settings, aiSettings] = await Promise.all([
      getSettings(),
      getAISettings(),
    ]);
    // ------------------

    const cleanFilename = this.cleanFilename(filename);
    const rootPath = await getLastScanPath();

    const cleanedFile = await this.isCleanedFile(
      filePath,
      rootPath,
      filename,
      cleanFilename,
      file.sizeBytes,
    );
    if (cleanedFile) {
      return cleanedFile;
    }

    // 1. Detect episode info early (Case-Insensitive)
    let episodeInfo = this.detectEpisodeInfo(filename, parentDir);

    // PathContext Fallback for individual analysis — separator-gated, never blind
    if (!episodeInfo && pathContext?.season !== undefined) {
      const afterSep = filename.match(
        /[-_.\s]+(\d{1,3})(?!\d)(?!\s*(?:19|20)\d{2})/i,
      );
      if (afterSep) {
        episodeInfo = {
          season: pathContext.season,
          episodes: [parseInt(afterSep[1], 10)],
          rawMatch: 'Scanner PathContext Fallback (separator-gated)',
        };
      }
    }

    // 2. Fetch settings

    let tmdbResults: TmdbMatchResult[] = [];
    let enrichedEpisodeTitle: string | undefined;
    let isAiFallback = false;
    let fallbackYear: string | undefined;

    try {
      if (settings.tmdbApiKey) {
        if (cancelRequested) throw new Error('Cancellation requested');

        const searchQuery = this.prepareSearchQuery(filename);
        tmdbResults = await TmdbService.searchMulti(
          searchQuery,
          settings.tmdbApiKey,
        );

        // Filter results by forced type if provided
        if (forcedType) {
          tmdbResults = tmdbResults.filter((r) => r.type === forcedType);
        }

        if (tmdbResults.length === 0) {
          console.log(
            `[AnalysisService] TMDB empty for "${cleanFilename}", triggering LLM fallback extraction.`,
          );
          const extractionPrompt = this.generateTitleExtractionPrompt(
            filename,
            parentDir,
          );
          if (cancelRequested) throw new Error('Cancellation requested');
          const extractionResponse = await AIService.generate(aiSettings, {
            prompt: extractionPrompt,
            systemPrompt:
              'You are a JSON-only API. return ONLY raw JSON, no markdown formatting.',
          });

          if (!extractionResponse.error) {
            try {
              const jsonText = extractionResponse.text
                .trim()
                .replace(/^```(?:json)?\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();
              const extracted = JSON.parse(jsonText);

              if (extracted.title) {
                console.log(
                  `[AnalysisService] LLM Extracted Title: "${extracted.title}", Year: "${extracted.year || 'none'}"`,
                );
                if (cancelRequested) throw new Error('Cancellation requested');
                tmdbResults = await TmdbService.searchMulti(
                  extracted.title,
                  settings.tmdbApiKey,
                );

                // Filter results by forced type if provided
                if (forcedType) {
                  tmdbResults = tmdbResults.filter(
                    (r) => r.type === forcedType,
                  );
                }

                fallbackYear = extracted.year;
                isAiFallback = true;
              }
            } catch (e) {
              console.warn(
                '[AnalysisService] Failed to parse LLM extraction:',
                e,
              );
            }
          }
        }

        if (tmdbResults.length > 0) {
          // Smart Match: prioritize exact year match
          const yearFromFilename = fallbackYear || this.extractYear(filename);
          const yearFromParent = this.extractYear(parentDir);
          const targetYear = yearFromFilename ?? yearFromParent;

          // If the first page of search results doesn't contain an exact TITLE + YEAR match,
          // fire a targeted year search to ensure the movie wasn't buried on page 2+.
          if (targetYear) {
            const normalizeTitle = (str: string) =>
              str
                ? str
                    .replace(/[^a-zA-Z0-9\s]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .toLowerCase()
                : '';
            const cleanOriginalName = normalizeTitle(
              this.prepareSearchQuery(filename),
            );

            const hasExactTitleAndYearMatch = tmdbResults.some(
              (r) =>
                r.year === targetYear &&
                normalizeTitle(r.title) === cleanOriginalName,
            );

            if (!hasExactTitleAndYearMatch) {
              console.log(
                `[AnalysisService] No exact title+year match in initial results for "${searchQuery}" (${targetYear}). Fetching targeted results.`,
              );
              const targetedResults = await TmdbService.searchByYear(
                searchQuery,
                targetYear,
                settings.tmdbApiKey,
              );
              const existingIds = new Set(
                tmdbResults.map((r) => `${r.type}-${r.id}`),
              );
              for (const tr of targetedResults) {
                if (!existingIds.has(`${tr.type}-${tr.id}`)) {
                  tmdbResults.push(tr);
                }
              }
            }
          }

          tmdbResults = this.prioritizeMatches(
            tmdbResults,
            targetYear,
            filename,
          );
          let topResult = tmdbResults[0];

          // --- DETERMINISTIC TMDB-FIRST LOGIC ---
          // If we have a high-confidence match (same year for movie, or detected TV),
          // we can bypass AI entirely.
          let isHighConfidenceMovie = false;

          if (
            topResult.type === 'movie' &&
            targetYear &&
            topResult.year === targetYear
          ) {
            const exactYearMatches = tmdbResults.filter(
              (r) => r.type === 'movie' && r.year === targetYear,
            );

            if (exactYearMatches.length === 1) {
              isHighConfidenceMovie = true;
            } else {
              // Multiple movies share this year. Ensure the top result is an exact title match.
              const normalizeTitle = (str: string) =>
                str
                  ? str
                      .replace(/[^a-zA-Z0-9\s]/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim()
                      .toLowerCase()
                  : '';

              const cleanOriginalName = normalizeTitle(
                this.prepareSearchQuery(filename),
              );
              const topCleanTitle = normalizeTitle(topResult.title);

              if (topCleanTitle === cleanOriginalName) {
                isHighConfidenceMovie = true;
              }
            }
          }

          if (isHighConfidenceMovie) {
            console.log(
              `[AnalysisService] Deterministic match for movie: ${topResult.title} (${topResult.year})`,
            );
            const ext = path.extname(filename);
            const { sanitizePathSegment } =
              await import('@medularity/archivist-core');
            const sanitizedTitle = sanitizePathSegment(topResult.title);
            const baseName = sanitizePathSegment(
              `${sanitizedTitle} (${topResult.year})`,
            );
            const suggestedName = `${baseName}${ext}`;

            return {
              filePath,
              originalName: filename,
              suggestedName,
              isClean: filename === suggestedName,
              score: 1.0,
              reason: 'Deterministic TMDB Match (Movie)',
              metadata: {
                title: topResult.title,
                year: topResult.year || '',
                tmdbId: topResult.id,
                posterUrl: topResult.posterUrl,
                type: 'movie',
              },
              sizeBytes: file.sizeBytes,
              matches: tmdbResults.slice(0, MAX_MATCHES),
            };
          }

          // If detected as TV or TMDB says TV — fetch episode details for title
          if (episodeInfo && topResult.type === 'tv' && settings.tmdbApiKey) {
            try {
              const epDetails = await TmdbService.getTvEpisode(
                topResult.id,
                episodeInfo.season,
                episodeInfo.episode,
                settings.tmdbApiKey,
              );
              if (cancelRequested) throw new Error('Cancellation requested');
              if (epDetails) {
                const { sanitizePathSegment } =
                  await import('@medularity/archivist-core');
                enrichedEpisodeTitle = sanitizePathSegment(epDetails.name);
              }
            } catch (e) {
              console.warn(
                '[AnalysisService] Could not fetch episode details:',
                e,
              );
            }
          }
        }
      } else {
        throw new Error('No TMDB API key');
      }
    } catch (error) {
      console.warn('TMDB lookup failed:', error);
    }

    // 4. Construct Final Result Deterministically
    const { name: originalBase, ext: originalExt } = path.parse(filename);
    let suggestedName = filename;
    let score = 0.5;
    let reason = 'Initial Cleanup';

    const resultMetadata: any = {
      title: cleanFilename,
      year: this.extractYear(filename) ?? '',
    };

    if (tmdbResults.length > 0) {
      const topResult = tmdbResults[0];
      const { sanitizePathSegment } =
        await import('@medularity/archivist-core');
      const sanitizedTitle = sanitizePathSegment(topResult.title);

      score = 0.8;
      reason = 'TMDB Match';

      resultMetadata.title = topResult.title;
      resultMetadata.year = topResult.year || '';
      resultMetadata.tmdbId = topResult.id;
      resultMetadata.posterUrl = topResult.posterUrl;
      resultMetadata.type = forcedType || topResult.type;

      if (resultMetadata.type === 'movie') {
        const baseName = sanitizePathSegment(
          `${sanitizedTitle} (${topResult.year})`,
        );
        suggestedName = `${baseName}${originalExt}`;
      } else if (resultMetadata.type === 'tv') {
        // If it's TV but we lack episode info, try one last time to find a number
        if (!episodeInfo) {
          const numMatch = filename.match(/\b(\d{1,3})\b/);
          if (numMatch) {
            episodeInfo = {
              season: 1,
              episodes: [parseInt(numMatch[1], 10)],
              rawMatch: 'Forced TV Fallback',
            };
          }
        }

        if (episodeInfo) {
          resultMetadata.season = episodeInfo.season;
          resultMetadata.episode = episodeInfo.episodes[0];
          resultMetadata.episodeTitle = enrichedEpisodeTitle;

          const seasonStr = String(episodeInfo.season).padStart(2, '0');
          const episodeStr = String(episodeInfo.episodes[0]).padStart(2, '0');

          let baseName = '';
          if (enrichedEpisodeTitle) {
            baseName = sanitizePathSegment(
              `${sanitizedTitle} - S${seasonStr}E${episodeStr} - ${enrichedEpisodeTitle}`,
            );
          } else {
            baseName = sanitizePathSegment(
              `${sanitizedTitle} - S${seasonStr}E${episodeStr}`,
            );
          }
          suggestedName = `${baseName}${originalExt}`;
        } else {
          // Just a TV show name if no episode found
          suggestedName = `${sanitizedTitle}${originalExt}`;
        }
      }
    }

    // 5. Compute seriesRoot for TV episodes
    let seriesRoot: string | undefined;
    if (
      resultMetadata.type === 'tv' &&
      resultMetadata.title &&
      resultMetadata.season !== undefined
    ) {
      const { sanitizePathSegment } =
        await import('@medularity/archivist-core');
      const showFolder = sanitizePathSegment(
        `${resultMetadata.title}${resultMetadata.year ? ` (${resultMetadata.year})` : ''}`,
      );
      seriesRoot = path.join(showFolder, `Season ${resultMetadata.season}`);
    }

    const finalResult: AnalysisResult = {
      filePath,
      originalName: filename,
      suggestedName,
      isClean: filename === suggestedName,
      score,
      reason,
      seriesRoot,
      isAiFallback,
      metadata: resultMetadata,
      sizeBytes: file.sizeBytes,
      matches: this.prioritizeMatches(
        tmdbResults,
        resultMetadata.year,
        filename,
      ),
    };

    // Live Update: If clean, persist to optimization state immediately
    if (finalResult.isClean) {
      try {
        const stats = await fs.stat(filePath);
        await OptimizationStateService.updateFileState(
          rootPath || path.dirname(filePath),
          filePath,
          true,
          stats.mtimeMs,
        );
      } catch (e) {
        console.warn('Failed to update live optimization state:', e);
      }
    }

    return finalResult;
  },

  /**
   * Extract year from string (YYYY)
   */
  extractYear(text: string): string | null {
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? yearMatch[0] : null;
  },

  async applyFix(result: AnalysisResult): Promise<string | null> {
    try {
      const { filePath, originalName, suggestedName } = result;
      const rootPath = await getLastScanPath();
      const settings = await getSettings();

      // 1. Determine target path
      let newPath = filePath;

      const isTv = result.metadata?.type === 'tv';
      const shouldOrganize = settings.organizeSeriesIntoFolders === true;

      if (
        isTv &&
        shouldOrganize &&
        result.seriesRoot &&
        rootPath &&
        suggestedName &&
        suggestedName !== originalName
      ) {
        // Move into organized series folder structure (TV SHOWS)
        const targetDir = path.join(rootPath, result.seriesRoot);
        const sourceDir = path.dirname(filePath);
        await fs.mkdir(targetDir, { recursive: true });
        newPath = path.join(targetDir, suggestedName);
        await renameFileWithSubtitles(filePath, newPath);

        // Cleanup: Move remaining files and delete empty original folder
        if (sourceDir !== rootPath) {
          await moveRemainingFiles(sourceDir, targetDir);
          await cleanupEmptyFolder(sourceDir, rootPath);
        }
      } else if (suggestedName && suggestedName !== originalName) {
        // Rename in-place or handle Movie folder rename
        const sourceDir = path.dirname(filePath);
        const isMovie = result.metadata?.type === 'movie';

        // If it's a movie and it's in a dedicated folder (not root), rename the folder too
        if (
          isMovie &&
          rootPath &&
          sourceDir !== rootPath &&
          sourceDir.startsWith(rootPath)
        ) {
          const { sanitizePathSegment } =
            await import('@medularity/archivist-core');
          const { name: suggestedBase } = path.parse(suggestedName);
          const folderName = sanitizePathSegment(suggestedBase);
          const parentDir = path.dirname(sourceDir);
          const newDir = path.join(parentDir, folderName);

          if (newDir !== sourceDir) {
            try {
              await fs.rename(sourceDir, newDir);
              // After folder rename, update sourcePath and target path for file rename
              const updatedOldPath = path.join(newDir, originalName);
              newPath = path.join(newDir, suggestedName);
              await renameFileWithSubtitles(updatedOldPath, newPath);
            } catch (e) {
              console.warn(
                `Failed to rename movie folder from ${sourceDir} to ${newDir}:`,
                e,
              );
              // Fallback: just rename the file in place
              newPath = path.join(sourceDir, suggestedName);
              await renameFileWithSubtitles(filePath, newPath);
            }
          } else {
            // Folder already matches or same name, just rename the file
            newPath = path.join(sourceDir, suggestedName);
            await renameFileWithSubtitles(filePath, newPath);
          }
        } else {
          // Just rename the file (Movie in root, or TV organization disabled)
          newPath = path.join(sourceDir, suggestedName);
          await renameFileWithSubtitles(filePath, newPath);
        }
      } else {
        // log an error
        console.log(
          ' ------------------------------------------------------------------',
        );
        console.error(
          'Failed to apply fix: No suggested name or something went wrong',
        );
        console.log(result, settings);
        console.log(
          '------------------------------------------------------------------',
        );
      }

      // 2. Write Metadata if provided
      if (result.metadata && Object.keys(result.metadata).length > 0) {
        await embedMetadata(newPath, result.metadata);
      }

      // 3. Mark as clean
      try {
        const stats = await fs.stat(newPath);
        await OptimizationStateService.updateFileState(
          rootPath || path.dirname(newPath),
          newPath,
          true,
          stats.mtimeMs,
        );
      } catch (e) {
        console.warn('Failed to update optimization state after fix:', e);
      }

      return newPath;
    } catch (error) {
      console.error('Failed to apply fix:', error);
      return null;
    }
  },

  /**
   * Mark a file as manually optimized/clean
   */
  async markAsClean(filePath: string): Promise<void> {
    try {
      const rootPath = await getLastScanPath();
      const stats = await fs.stat(filePath);
      await OptimizationStateService.updateFileState(
        rootPath || path.dirname(filePath),
        filePath,
        true,
        stats.mtimeMs,
      );
    } catch (error) {
      console.error('Failed to mark as clean:', error);
    }
  },

  /**
   * Reorder matches to prioritize those with matching release year
   */
  prioritizeMatches(
    matches: TmdbMatchResult[],
    targetYear: string | null,
    originalFilename: string,
  ): TmdbMatchResult[] {
    if (!matches || matches.length === 0) return [];

    const finalTargetYear = targetYear ?? this.extractYear(originalFilename);

    if (!finalTargetYear) {
      return matches.slice(0, MAX_MATCHES);
    }

    const targetYearInt = parseInt(finalTargetYear, 10);

    // Normalize string to just alphanumeric and spaces for robust exact-title matching
    const normalizeTitle = (str: string) => {
      if (!str) return '';
      return str
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    };

    const cleanOriginalName = normalizeTitle(
      this.prepareSearchQuery(originalFilename),
    );

    // Sort matches: Exact year -> +/- 1 year -> others
    // Within those buckets, prioritize exact title matches
    const sorted = [...matches].sort((a, b) => {
      const aYearInt = a.year ? parseInt(a.year, 10) : NaN;
      const bYearInt = b.year ? parseInt(b.year, 10) : NaN;

      const aIsExact = a.year === finalTargetYear;
      const bIsExact = b.year === finalTargetYear;

      if (aIsExact && !bIsExact) return -1;
      if (!aIsExact && bIsExact) return 1;

      const aIsClose =
        !isNaN(aYearInt) && Math.abs(aYearInt - targetYearInt) <= 1;
      const bIsClose =
        !isNaN(bYearInt) && Math.abs(bYearInt - targetYearInt) <= 1;

      if (aIsClose && !bIsClose) return -1;
      if (!aIsClose && bIsClose) return 1;

      // Both are in the same year bucket (or both are missing years).
      // Prioritize exact title matches (ignoring case and weird punctuation).
      const aCleanTitle = normalizeTitle(a.title);
      const bCleanTitle = normalizeTitle(b.title);

      const aTitleMatch = aCleanTitle === cleanOriginalName;
      const bTitleMatch = bCleanTitle === cleanOriginalName;

      if (aTitleMatch && !bTitleMatch) return -1;
      if (!aTitleMatch && bTitleMatch) return 1;

      // Maintain original search relevance ranking as much as possible for ties
      return 0;
    });

    return sorted.slice(0, MAX_MATCHES);
  },

  /**
   * Retrieves all previously analyzed or clean results for a given path.
   */
  async loadCachedResults(rootPath: string): Promise<AnalysisResult[]> {
    const dbResults = DatabaseService.getAIResults();

    return dbResults
      .filter((file) => file.path.startsWith(rootPath))
      .map((file) => {
        const metadata = file.analysisResult
          ? JSON.parse(file.analysisResult)
          : {
              title: file.filename.replace(/\.[^/.]+$/, ''),
              year: this.extractYear(file.filename) ?? '',
              type: file.pathContext?.season !== undefined ? 'tv' : 'movie',
              season: file.pathContext?.season,
              tmdbId: undefined,
            };

        return {
          filePath: file.path,
          originalName: file.filename,
          suggestedName: file.suggestedName || file.filename,
          isClean: file.isClean === true,
          score: 1.0,
          reason: 'Cached State (SQLite)',
          metadata,
          sizeBytes: file.sizeBytes,
        };
      });
  },
};
