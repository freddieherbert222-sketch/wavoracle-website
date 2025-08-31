import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { WebScrapingService, ScrapedMusicData } from './web-scraping.service';

export interface AIInsight {
  songTitle: string;
  artist: string;
  keyAnalysis: string;
  bpmAnalysis: string;
  keyChanges: string[];
  bpmVariations: string[];
  productionNotes: string[];
  researchSources: string[];
  confidence: 'high' | 'medium' | 'low';
  timestamp: Date;
}

export interface DeepSeekRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user';
    content: string;
  }>;
  temperature: number;
  max_tokens: number;
}

export interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export interface CostControlConfig {
  maxTokensPerDay: number;
  maxTokensPerUser: number;
  maxTokensPerRequest: number;
  enableCaching: boolean;
  enableFallbacks: boolean;
  enableRateLimiting: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DeepSeekAIService {
  private readonly apiUrl = `${environment.apiBaseUrl}/deepseek/chat`; // Backend proxy route
  private readonly apiKey = undefined as unknown as string; // Never used on client; kept for typing
  private lastMode: 'ai' | 'free' = 'ai';
  
  // Cost Control & Monitoring
  private dailyTokenUsage = 0;
  private userTokenUsage = new Map<string, number>();
  private requestCache = new Map<string, AIInsight>();
  private lastResetDate = new Date().toDateString();
  
  // Default cost control settings (FREE TIER FRIENDLY)
  private costConfig: CostControlConfig = {
    maxTokensPerDay: 10000,        // Conservative daily limit
    maxTokensPerUser: 2000,        // Per user daily limit
    maxTokensPerRequest: 800,      // Reduced from 1000
    enableCaching: true,           // Cache results to save tokens
    enableFallbacks: true,         // Use free alternatives when possible
    enableRateLimiting: true       // Prevent abuse
  };

  constructor(
    private http: HttpClient,
    private webScrapingService: WebScrapingService
  ) {
    this.resetDailyUsage();
  }

  /**
   * Generate AI insights with cost control
   */
  async generateMusicalInsights(youtubeTitle: string, audioAnalysisResult?: any, userId?: string): Promise<AIInsight> {
    try {
      console.log(`🔮 Generating AI insights for: ${youtubeTitle}`);

      // Check cost control limits
      if (!this.canMakeRequest(userId)) {
        this.lastMode = 'free';
        return this.generateFallbackInsights(youtubeTitle, audioAnalysisResult);
      }

      // Check cache first (save tokens!)
      const cacheKey = this.generateCacheKey(youtubeTitle, audioAnalysisResult);
      if (this.costConfig.enableCaching && this.requestCache.has(cacheKey)) {
        console.log('💾 Returning cached AI insights (saving tokens!)');
        return this.requestCache.get(cacheKey)!;
      }

      // Create optimized prompts (reduce token usage)
      const systemPrompt = this.createOptimizedSystemPrompt();
      const userPrompt = this.createOptimizedUserPrompt(youtubeTitle, audioAnalysisResult);

      // Make API request with reduced token limit
      const response = await this.makeDeepSeekRequest(systemPrompt, userPrompt);
      
      // Track token usage
      this.trackTokenUsage(response.usage.total_tokens, userId);
      
      // Parse the response into structured insights
      const insights = this.parseAIResponse(response.choices[0].message.content, youtubeTitle);
      
      // Cache the result (save future tokens!)
      if (this.costConfig.enableCaching) {
        this.requestCache.set(cacheKey, insights);
      }
      
      console.log(`✅ AI insights generated successfully (${response.usage.total_tokens} tokens used)`);
      this.lastMode = 'ai';
      return insights;

    } catch (error) {
      console.error('❌ Failed to generate AI insights:', error);
      // Always fallback to free alternatives
      this.lastMode = 'free';
      return this.generateFallbackInsights(youtubeTitle, audioAnalysisResult);
    }
  }

  /**
   * Check if we can make a new request (cost control)
   */
  private canMakeRequest(userId?: string): boolean {
    // Reset daily usage if it's a new day
    this.resetDailyUsage();
    
    // Check daily limit
    if (this.dailyTokenUsage >= this.costConfig.maxTokensPerDay) {
      console.warn('⚠️ Daily token limit reached, using fallback');
      return false;
    }
    
    // Check user limit
    if (userId && this.userTokenUsage.get(userId) >= this.costConfig.maxTokensPerUser) {
      console.warn(`⚠️ User ${userId} token limit reached, using fallback`);
      return false;
    }
    
    return true;
  }

  /**
   * Track token usage for cost control
   */
  private trackTokenUsage(tokens: number, userId?: string): void {
    this.dailyTokenUsage += tokens;
    
    if (userId) {
      const currentUsage = this.userTokenUsage.get(userId) || 0;
      this.userTokenUsage.set(userId, currentUsage + tokens);
    }
    
    console.log(`💰 Token usage: Daily ${this.dailyTokenUsage}/${this.costConfig.maxTokensPerDay}, User ${userId}: ${this.userTokenUsage.get(userId) || 0}/${this.costConfig.maxTokensPerUser}`);
  }

  /**
   * Reset daily usage counter
   */
  private resetDailyUsage(): void {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailyTokenUsage = 0;
      this.userTokenUsage.clear();
      this.lastResetDate = today;
      console.log('🔄 Daily token usage reset');
    }
  }

  /**
   * Generate fallback insights using web scraping
   */
  private async generateFallbackInsights(youtubeTitle: string, audioAnalysisResult?: any): Promise<AIInsight> {
    console.log('🆓 Generating FREE fallback insights using web scraping');
    
    const { artist, songTitle } = this.extractArtistAndTitle(youtubeTitle);
    
    // Try web scraping for key/BPM data
    let scrapedData: ScrapedMusicData[] = [];
    try {
      scrapedData = await this.webScrapingService.scrapeAllSources(songTitle, artist);
      console.log(`🔍 Web scraping results: ${scrapedData.length} sources`);
    } catch (error) {
      console.warn('⚠️ Web scraping failed, using basic fallback');
    }
    
    // Use audio analysis results if available
    let keyAnalysis = 'Analysis pending';
    let bpmAnalysis = 'Analysis pending';
    
    if (audioAnalysisResult && audioAnalysisResult.finalResult) {
      const { key, bpm, confidence } = audioAnalysisResult.finalResult;
      keyAnalysis = `Detected: ${key} (Confidence: ${confidence})`;
      bpmAnalysis = `Detected: ${bpm} BPM (Confidence: ${confidence})`;
    }
    
    // Use web scraping data if available
    if (scrapedData.length > 0) {
      const bestData = this.webScrapingService.getBestData(scrapedData);
      if (bestData) {
        if (bestData.key && keyAnalysis === 'Analysis pending') {
          keyAnalysis = `Web: ${bestData.key} (${bestData.source})`;
        }
        if (bestData.bpm && bpmAnalysis === 'Analysis pending') {
          bpmAnalysis = `Web: ${bestData.bpm} BPM (${bestData.source})`;
        }
      }
    }
    
    return {
      songTitle,
      artist,
      keyAnalysis,
      bpmAnalysis,
      keyChanges: ['Use your ears to detect key changes'],
      bpmVariations: ['Use your ears to detect tempo changes'],
      productionNotes: ['Listen carefully for production techniques'],
      researchSources: scrapedData.length > 0 ? 
        scrapedData.map(d => d.source) : ['Manual research recommended'],
      confidence: 'medium',
      timestamp: new Date()
    };
  }

  /**
   * Create optimized system prompt (reduce tokens)
   */
  private createOptimizedSystemPrompt(): string {
    return [
      'Role: Music analyst. Provide factual insights from the YouTube title.',
      'Rules: Be precise, research-based, no speculation. Avoid hallucinations.',
      'If key/BPM are provided, reference them; otherwise avoid guessing exact numeric values.',
      'Output Sections: Key Analysis, BPM Analysis, Key Changes, BPM Variations, Production Notes, Research Sources.',
    ].join(' ');
  }

  /**
   * Create optimized user prompt (reduce tokens)
   */
  private createOptimizedUserPrompt(youtubeTitle: string, audioAnalysisResult?: any): string {
    let prompt = `Analyze the track based on the YouTube title: "${youtubeTitle}".`;

    if (audioAnalysisResult && audioAnalysisResult.finalResult) {
      const { key, bpm, confidence } = audioAnalysisResult.finalResult;
      prompt += `\nAudio context: Key ${key}, BPM ${bpm} (confidence: ${confidence}). Provide additional insights and cross-check.`;
    }

    prompt += `\nIf unknown, say unknown. Include 2-4 research sources if possible.`;
    return prompt;
  }

  /**
   * Generate cache key for caching
   */
  private generateCacheKey(youtubeTitle: string, audioAnalysisResult?: any): string {
    const audioData = audioAnalysisResult ? JSON.stringify(audioAnalysisResult.finalResult) : '';
    return `${youtubeTitle}-${audioData}`;
  }

  /**
   * Make request to DeepSeek API with cost control
   */
  private async makeDeepSeekRequest(systemPrompt: string, userPrompt: string): Promise<DeepSeekResponse> {
    const request: DeepSeekRequest = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: this.costConfig.maxTokensPerRequest // Reduced token limit
    };

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    });

    try {
      const response = await this.http.post<DeepSeekResponse>(this.apiUrl, request, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }).toPromise();
      
      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error('Invalid response from DeepSeek API');
      }

      return response;

    } catch (error) {
      console.error('❌ DeepSeek API request failed:', error);
      throw new Error('Failed to get AI insights');
    }
  }

  /**
   * Parse AI response into structured insights
   */
  private parseAIResponse(aiResponse: string, youtubeTitle: string): AIInsight {
    // Extract artist and title from YouTube title
    const { artist, songTitle } = this.extractArtistAndTitle(youtubeTitle);

    // Parse the AI response for structured data
    const insights = this.extractInsightsFromResponse(aiResponse);

    return {
      songTitle,
      artist,
      keyAnalysis: insights.keyAnalysis || 'Analysis pending',
      bpmAnalysis: insights.bpmAnalysis || 'Analysis pending',
      keyChanges: insights.keyChanges || [],
      bpmVariations: insights.bpmVariations || [],
      productionNotes: insights.productionNotes || [],
      researchSources: insights.researchSources || [],
      confidence: insights.confidence || 'medium',
      timestamp: new Date()
    };
  }

  /**
   * Extract artist and title from YouTube title
   */
  private extractArtistAndTitle(fullTitle: string): { artist: string; songTitle: string } {
    // Common patterns: "Artist - Song Title", "Artist: Song Title"
    const patterns = [
      /^(.+?)\s*[-–—]\s*(.+)$/,           // "Artist - Song"
      /^(.+?)\s*:\s*(.+)$/,               // "Artist: Song"
      /^(.+?)\s+ft\.?\s+(.+?)\s*[-–—]\s*(.+)$/, // "Artist ft. Other - Song"
      /^(.+?)\s+feat\.?\s+(.+?)\s*[-–—]\s*(.+)$/ // "Artist feat. Other - Song"
    ];

    for (const pattern of patterns) {
      const match = fullTitle.match(pattern);
      if (match) {
        return {
          artist: match[1].trim(),
          songTitle: match[2] ? match[2].trim() : fullTitle.trim()
        };
      }
    }

    // Fallback: use full title as song title, unknown artist
    return {
      artist: 'Unknown Artist',
      songTitle: fullTitle.trim()
    };
  }

  /**
   * Extract structured insights from AI response
   */
  private extractInsightsFromResponse(aiResponse: string): any {
    const insights: any = {};

    // Extract key analysis
    const keyMatch = aiResponse.match(/Key Analysis:\s*(.+?)(?=\n|$)/i);
    if (keyMatch) insights.keyAnalysis = keyMatch[1].trim();

    // Extract BPM analysis
    const bpmMatch = aiResponse.match(/BPM Analysis:\s*(.+?)(?=\n|$)/i);
    if (bpmMatch) insights.bpmAnalysis = bpmMatch[1].trim();

    // Extract key changes
    const keyChangesMatch = aiResponse.match(/Key Changes:\s*(.+?)(?=\n|$)/i);
    if (keyChangesMatch) {
      insights.keyChanges = keyChangesMatch[1].split(',').map(s => s.trim());
    }

    // Extract BPM variations
    const bpmVariationsMatch = aiResponse.match(/BPM Variations:\s*(.+?)(?=\n|$)/i);
    if (bpmVariationsMatch) {
      insights.bpmVariations = bpmVariationsMatch[1].split(',').map(s => s.trim());
    }

    // Extract production notes
    const productionMatch = aiResponse.match(/Production Notes:\s*(.+?)(?=\n|$)/i);
    if (productionMatch) {
      insights.productionNotes = productionMatch[1].split(',').map(s => s.trim());
    }

    // Extract research sources
    const sourcesMatch = aiResponse.match(/Research Sources:\s*(.+?)(?=\n|$)/i);
    if (sourcesMatch) {
      insights.researchSources = sourcesMatch[1].split(',').map(s => s.trim());
    }

    return insights;
  }

  /**
   * Update cost control configuration
   */
  updateCostConfig(config: Partial<CostControlConfig>): void {
    this.costConfig = { ...this.costConfig, ...config };
    console.log('⚙️ Cost control configuration updated:', this.costConfig);
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(): any {
    return {
      dailyUsage: this.dailyTokenUsage,
      dailyLimit: this.costConfig.maxTokensPerDay,
      userUsage: Object.fromEntries(this.userTokenUsage),
      userLimit: this.costConfig.maxTokensPerUser,
      cacheSize: this.requestCache.size,
      lastReset: this.lastResetDate
    };
  }

  /**
   * Clear cache to free memory
   */
  clearCache(): void {
    this.requestCache.clear();
    console.log('🗑️ AI insights cache cleared');
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Check if service is available (within limits)
   */
  isAvailable(userId?: string): boolean {
    return this.isConfigured() && this.canMakeRequest(userId);
  }

  /**
   * Last mode used for insights: 'ai' or 'free'
   */
  getLastMode(): 'ai' | 'free' {
    return this.lastMode;
  }
} 