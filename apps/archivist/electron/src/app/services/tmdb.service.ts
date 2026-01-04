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

export class TmdbService {
  private static readonly BASE_URL = 'https://api.themoviedb.org/3';
  private static readonly IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

  /**
   * Validate an API key by calling the TMDB configuration endpoint
   */
  static async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    if (!apiKey || !apiKey.trim()) {
      return { valid: false, error: 'API key is empty' };
    }

    try {
      const url = `${this.BASE_URL}/configuration?api_key=${apiKey}`;
      const response = await fetch(url);

      if (response.ok) {
        return { valid: true };
      }

      if (response.status === 401) {
        return { valid: false, error: 'Invalid API key' };
      }

      return { valid: false, error: `API error: ${response.status}` };
    } catch (error) {
      return { valid: false, error: `Connection error: ${String(error)}` };
    }
  }

  static async fetchRating(
    title: string,
    apiKey: string,
    year?: string,
  ): Promise<TmdbRating | null> {
    if (!apiKey) {
      console.warn('TMDB API fetch skipped: No API key provided');
      return null;
    }

    try {
      // First, search for the movie
      const searchParams = new URLSearchParams({
        api_key: apiKey,
        query: title,
      });

      if (year) {
        searchParams.append('year', year);
      }

      const searchUrl = `${this.BASE_URL}/search/movie?${searchParams.toString()}`;
      const searchResponse = await fetch(searchUrl);

      if (!searchResponse.ok) {
        console.error(`TMDB search failed: ${searchResponse.statusText}`);
        return null;
      }

      const searchData = await searchResponse.json();

      if (!searchData.results || searchData.results.length === 0) {
        console.warn(`TMDB movie not found: ${title}`);
        return null;
      }

      const firstResult: TmdbSearchResult = searchData.results[0];

      // Get movie details for more info (including imdb_id)
      const detailsUrl = `${this.BASE_URL}/movie/${firstResult.id}?api_key=${apiKey}`;
      const detailsResponse = await fetch(detailsUrl);

      if (!detailsResponse.ok) {
        // Fall back to search result data if details fail
        return this.mapSearchResultToRating(firstResult);
      }

      const details: TmdbMovieDetails = await detailsResponse.json();
      return this.mapDetailsToRating(details);
    } catch (error) {
      console.error('Error fetching from TMDB:', error);
      return null;
    }
  }

  /**
   * Search for both movies and TV shows
   */
  static async searchMulti(
    query: string,
    apiKey: string,
  ): Promise<TmdbMatchResult[]> {
    if (!apiKey || !query.trim()) {
      return [];
    }

    try {
      const searchParams = new URLSearchParams({
        api_key: apiKey,
        query: query.trim(),
        include_adult: 'false',
      });

      const url = `${this.BASE_URL}/search/multi?${searchParams.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`TMDB multi search failed: ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      const results: TmdbMatchResult[] = [];

      for (const item of data.results || []) {
        if (item.media_type === 'movie') {
          results.push({
            id: item.id,
            type: 'movie',
            title: item.title,
            year: item.release_date ? item.release_date.substring(0, 4) : '',
            rating: item.vote_average,
            posterUrl: item.poster_path
              ? `${this.IMAGE_BASE_URL}${item.poster_path}`
              : null,
            overview: item.overview || '',
          });
        } else if (item.media_type === 'tv') {
          results.push({
            id: item.id,
            type: 'tv',
            title: item.name,
            year: item.first_air_date
              ? item.first_air_date.substring(0, 4)
              : '',
            rating: item.vote_average,
            posterUrl: item.poster_path
              ? `${this.IMAGE_BASE_URL}${item.poster_path}`
              : null,
            overview: item.overview || '',
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error in TMDB multi search:', error);
      return [];
    }
  }

  /**
   * Get TV show details
   */
  static async getTvShowDetails(
    tvId: number,
    apiKey: string,
  ): Promise<TmdbTvShowDetails | null> {
    if (!apiKey) return null;

    try {
      const url = `${this.BASE_URL}/tv/${tvId}?api_key=${apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`TMDB TV details failed: ${response.statusText}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching TV details:', error);
      return null;
    }
  }

  /**
   * Get TV episode details
   */
  static async getTvEpisode(
    tvId: number,
    season: number,
    episode: number,
    apiKey: string,
  ): Promise<TmdbEpisodeDetails | null> {
    if (!apiKey) return null;

    try {
      const url = `${this.BASE_URL}/tv/${tvId}/season/${season}/episode/${episode}?api_key=${apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`TMDB episode fetch failed: ${response.statusText}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching episode:', error);
      return null;
    }
  }

  private static mapSearchResultToRating(result: TmdbSearchResult): TmdbRating {
    const releaseYear = result.release_date
      ? result.release_date.substring(0, 4)
      : '';

    return {
      tmdbId: result.id,
      imdbId: '',
      title: result.title,
      year: releaseYear,
      rating: result.vote_average,
      voteCount: result.vote_count,
      runtime: 'N/A',
      genre: '',
      posterUrl: result.poster_path
        ? `${this.IMAGE_BASE_URL}${result.poster_path}`
        : null,
      overview: result.overview,
      fetchedAt: Date.now(),
    };
  }

  private static mapDetailsToRating(details: TmdbMovieDetails): TmdbRating {
    const releaseYear = details.release_date
      ? details.release_date.substring(0, 4)
      : '';

    const runtimeStr = details.runtime
      ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m`
      : 'N/A';

    const genres = details.genres.map((g) => g.name).join(', ');

    return {
      tmdbId: details.id,
      imdbId: details.imdb_id || '',
      title: details.title,
      year: releaseYear,
      rating: details.vote_average,
      voteCount: details.vote_count,
      runtime: runtimeStr,
      genre: genres,
      posterUrl: details.poster_path
        ? `${this.IMAGE_BASE_URL}${details.poster_path}`
        : null,
      overview: details.overview,
      fetchedAt: Date.now(),
    };
  }
}
