import { OmdbRating } from '../models';

export class OmdbService {
  private static readonly BASE_URL = 'https://www.omdbapi.com/';

  /**
   * Validate an API key by making a test query
   */
  static async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    if (!apiKey || !apiKey.trim()) {
      return { valid: false, error: 'API key is empty' };
    }

    try {
      // Use a known movie for validation
      const params = new URLSearchParams({
        apikey: apiKey,
        i: 'tt0111161', // The Shawshank Redemption - a reliable IMDB ID
      });

      const url = `${this.BASE_URL}?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        return { valid: false, error: `API error: ${response.status}` };
      }

      const data = await response.json();

      if (data.Response === 'False') {
        // OMDB returns error in Response field
        if (data.Error?.toLowerCase().includes('invalid api key')) {
          return { valid: false, error: 'Invalid API key' };
        }
        return { valid: false, error: data.Error || 'Unknown error' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: `Connection error: ${String(error)}` };
    }
  }

  static async fetchRating(
    title: string,
    apiKey: string,
    year?: string,
  ): Promise<OmdbRating | null> {
    if (!apiKey) {
      console.warn('OMDB API fetch skipped: No API key provided');
      return null;
    }

    try {
      const params = new URLSearchParams({
        apikey: apiKey,
        t: title,
      });

      if (year) {
        params.append('y', year);
      }

      const url = `${this.BASE_URL}?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(
          `OMDB fetch failed for url: ${url}: ${response.statusText}`,
        );
        return null;
      }

      const data = await response.json();

      if (data.Response === 'False') {
        console.warn(`OMDB movie not found: ${title} (${data.Error})`);
        return null;
      }

      return {
        ...data,
        fetchedAt: Date.now(),
      } as OmdbRating;
    } catch (error) {
      console.error('Error fetching from OMDB:', error);
      return null;
    }
  }
}
