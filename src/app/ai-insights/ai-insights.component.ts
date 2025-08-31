import { Component, OnInit, Input, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { DeepSeekAIService, AIInsight } from '../deepseek-ai.service';

@Component({
  selector: 'app-ai-insights',
  templateUrl: './ai-insights.component.html',
  styleUrls: ['./ai-insights.component.sass']
})
export class AIInsightsComponent implements OnInit, OnDestroy, OnChanges {
  @Input() youtubeTitle: string = '';
  @Input() audioAnalysisResult: any = null;
  
  private destroy$ = new Subject<void>();
  
  insights: AIInsight | null = null;
  isGenerating = false;
  error: string | null = null;
  progress = 0;
  private lastRequestedKey = '';
  isFreeInsights = false;

  constructor(private deepseekService: DeepSeekAIService) {}

  ngOnInit(): void {
    // Auto-generate insights when component receives data
    if (this.youtubeTitle && this.deepseekService.isConfigured()) {
      this.generateInsights();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['youtubeTitle'] || changes['audioAnalysisResult']) && this.canGenerateInsights()) {
      const cacheKey = `${this.youtubeTitle}-${JSON.stringify(this.audioAnalysisResult?.finalResult || {})}`;
      if (cacheKey !== this.lastRequestedKey) {
        this.lastRequestedKey = cacheKey;
        this.generateInsights();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Generate AI insights for the YouTube video
   */
  async generateInsights(): Promise<void> {
    if (!this.youtubeTitle || !this.deepseekService.isConfigured()) {
      this.error = 'YouTube title or DeepSeek API not available';
      return;
    }

    this.isGenerating = true;
    this.progress = 0;
    this.error = null;
    this.insights = null;

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        this.progress += Math.random() * 20;
        if (this.progress >= 80) {
          clearInterval(progressInterval);
        }
      }, 300);

      // Generate insights
      this.insights = await this.deepseekService.generateMusicalInsights(
        this.youtubeTitle, 
        this.audioAnalysisResult
      );
      // If DeepSeek fell back to scraping, mark as free insights
      this.isFreeInsights = !this.deepseekService.isAvailable();

      clearInterval(progressInterval);
      this.progress = 100;

      console.log('🔮 AI insights generated:', this.insights);

    } catch (error) {
      console.error('❌ Failed to generate AI insights:', error);
      this.error = 'Failed to generate AI insights. Please try again.';
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Get confidence color class
   */
  getConfidenceColor(confidence: string): string {
    switch (confidence) {
      case 'high': return 'text-success';
      case 'medium': return 'text-warning';
      case 'low': return 'text-danger';
      default: return 'text-muted';
    }
  }

  /**
   * Get confidence icon
   */
  getConfidenceIcon(confidence: string): string {
    switch (confidence) {
      case 'high': return '🎯';
      case 'medium': return '⚠️';
      case 'low': return '❌';
      default: return '❓';
    }
  }

  /**
   * Check if insights are available
   */
  hasInsights(): boolean {
    return this.insights !== null && !this.isGenerating && !this.error;
  }

  /**
   * Check if component is ready to generate insights
   */
  canGenerateInsights(): boolean {
    return !!this.youtubeTitle && this.deepseekService.isConfigured();
  }

  /**
   * Reset insights
   */
  resetInsights(): void {
    this.insights = null;
    this.error = null;
    this.progress = 0;
  }
} 