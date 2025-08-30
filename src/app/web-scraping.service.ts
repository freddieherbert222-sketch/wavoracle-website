import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';

export interface ScrapedMusicData {
  key?: string;
  bpm?: number;
  confidence: 'high' | 'medium' | 'low';
  source: string;
  url: string;
  timestamp: Date;
}

export interface ScrapingResult {
  success: boolean;
  data?: ScrapedMusicData;
  error?: string;
  source: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebScrapingService {
  private readonly TUNEBAT_BASE_URL = 'https://tunebat.com';
  private readonly REDDIT_BASE_URL = 'https://www.reddit.com';
  private readonly MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org';

  constructor(private http: HttpClient) {}

  /**
   * Scrape multiple sources for music data
   */
  async scrapeAllSources(songTitle: string, artist?: string): Promise<ScrapedMusicData[]> {
    const results: ScrapedMusicData[] = [];
    
    try {
      // Try Tunebat first (most reliable for key/BPM)
      const tunebatResult = await this.scrapeTunebat(songTitle, artist);
      if (tunebatResult.success && tunebatResult.data) {
        results.push(tunebatResult.data);
      }

      // Try Reddit for community insights
      const redditResult = await this.scrapeReddit(songTitle, artist);
      if (redditResult.success && redditResult.data) {
        results.push(redditResult.data);
      }

      // Try MusicBrainz for metadata
      const musicbrainzResult = await this.scrapeMusicBrainz(songTitle, artist);
      if (musicbrainzResult.success && musicbrainzResult.data) {
        results.push(musicbrainzResult.data);
      }

    } catch (error) {
      console.error('❌ Error scraping music data:', error);
    }

    return results;
  }

  /**
   * Scrape Tunebat for key/BPM data
   */
  private async scrapeTunebat(songTitle: string, artist?: string): Promise<ScrapingResult> {
    try {
      const searchQuery = artist ? `${artist} ${songTitle}` : songTitle;
      const searchUrl = `${this.TUNEBAT_BASE_URL}/Search?q=${encodeURIComponent(searchQuery)}`;
      
      console.log(`🔍 Scraping Tunebat: ${searchUrl}`);
      
      // Note: In a real implementation, you'd need a backend proxy due to CORS
      // For now, we'll simulate the response
      const mockData: ScrapedMusicData = {
        key: this.generateMockKey(),
        bpm: this.generateMockBPM(),
        confidence: 'medium',
        source: 'Tunebat',
        url: searchUrl,
        timestamp: new Date()
      };

      return {
        success: true,
        data: mockData,
        source: 'Tunebat'
      };

    } catch (error) {
      console.error('❌ Tunebat scraping failed:', error);
      return {
        success: false,
        error: 'Tunebat scraping failed',
        source: 'Tunebat'
      };
    }
  }

  /**
   * Scrape Reddit for community insights
   */
  private async scrapeReddit(songTitle: string, artist?: string): Promise<ScrapingResult> {
    try {
      const searchQuery = artist ? `${artist} ${songTitle}` : songTitle;
      const searchUrl = `${this.REDDIT_BASE_URL}/search.json?q=${encodeURIComponent(searchQuery)}&restrict_sr=on&t=all&sort=relevance`;
      
      console.log(`🔍 Scraping Reddit: ${searchUrl}`);
      
      // Note: Reddit API requires proper authentication
      // For now, we'll simulate community insights
      const mockData: ScrapedMusicData = {
        key: this.generateMockKey(),
        bpm: this.generateMockBPM(),
        confidence: 'low',
        source: 'Reddit Community',
        url: searchUrl,
        timestamp: new Date()
      };

      return {
        success: true,
        data: mockData,
        source: 'Reddit'
      };

    } catch (error) {
      console.error('❌ Reddit scraping failed:', error);
      return {
        success: false,
        error: 'Reddit scraping failed',
        source: 'Reddit'
      };
    }
  }

  /**
   * Scrape MusicBrainz for metadata
   */
  private async scrapeMusicBrainz(songTitle: string, artist?: string): Promise<ScrapingResult> {
    try {
      const searchQuery = artist ? `${artist} ${songTitle}` : songTitle;
      const searchUrl = `${this.MUSICBRAINZ_BASE_URL}/ws/2/recording/?query=${encodeURIComponent(searchQuery)}&fmt=json`;
      
      console.log(`🔍 Scraping MusicBrainz: ${searchUrl}`);
      
      // Note: MusicBrainz has rate limits and requires proper headers
      // For now, we'll simulate metadata
      const mockData: ScrapedMusicData = {
        key: undefined, // MusicBrainz doesn't provide key/BPM
        bpm: undefined,
        confidence: 'low',
        source: 'MusicBrainz',
        url: searchUrl,
        timestamp: new Date()
      };

      return {
        success: true,
        data: mockData,
        source: 'MusicBrainz'
      };

    } catch (error) {
      console.error('❌ MusicBrainz scraping failed:', error);
      return {
        success: false,
        error: 'MusicBrainz scraping failed',
        source: 'MusicBrainz'
      };
    }
  }

  /**
   * Generate mock key for testing (remove in production)
   */
  private generateMockKey(): string {
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const modes = ['major', 'minor'];
    const key = keys[Math.floor(Math.random() * keys.length)];
    const mode = modes[Math.floor(Math.random() * modes.length)];
    return `${key} ${mode}`;
  }

  /**
   * Generate mock BPM for testing (remove in production)
   */
  private generateMockBPM(): number {
    // Common BPM ranges for different genres
    const bpmRanges = [
      [60, 80],   // Slow
      [80, 120],  // Medium
      [120, 140], // Fast
      [140, 180]  // Very Fast
    ];
    
    const range = bpmRanges[Math.floor(Math.random() * bpmRanges.length)];
    return Math.floor(Math.random() * (range[1] - range[0])) + range[0];
  }

  /**
   * Get the best available data from all sources
   */
  getBestData(results: ScrapedMusicData[]): ScrapedMusicData | null {
    if (results.length === 0) return null;
    
    // Sort by confidence (high > medium > low)
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    
    return results.sort((a, b) => 
      confidenceOrder[b.confidence] - confidenceOrder[a.confidence]
    )[0];
  }

  /**
   * Check if any source has key/BPM data
   */
  hasKeyOrBPMData(results: ScrapedMusicData[]): boolean {
    return results.some(result => result.key || result.bpm);
  }
} 