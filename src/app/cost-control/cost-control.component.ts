import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil, interval } from 'rxjs';
import { DeepSeekAIService, CostControlConfig } from '../deepseek-ai.service';

@Component({
  selector: 'app-cost-control',
  templateUrl: './cost-control.component.html',
  styleUrls: ['./cost-control.component.sass']
})
export class CostControlComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  usageStats: any = null;
  costConfig: CostControlConfig | null = null;
  isVisible = false;
  refreshInterval = 5000; // 5 seconds

  constructor(private deepseekService: DeepSeekAIService) {}

  ngOnInit(): void {
    // Auto-refresh usage stats
    interval(this.refreshInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.refreshUsageStats();
      });
    
    this.refreshUsageStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Refresh usage statistics
   */
  refreshUsageStats(): void {
    try {
      this.usageStats = this.deepseekService.getUsageStats();
    } catch (error) {
      console.error('Failed to get usage stats:', error);
    }
  }

  /**
   * Toggle cost control visibility
   */
  toggleVisibility(): void {
    this.isVisible = !this.isVisible;
  }

  /**
   * Get usage percentage for progress bars
   */
  getDailyUsagePercentage(): number {
    if (!this.usageStats) return 0;
    return (this.usageStats.dailyUsage / this.usageStats.dailyLimit) * 100;
  }

  /**
   * Get usage color based on percentage
   */
  getUsageColor(percentage: number): string {
    if (percentage < 50) return 'success';
    if (percentage < 80) return 'warning';
    return 'danger';
  }

  /**
   * Get usage status text
   */
  getUsageStatus(): string {
    if (!this.usageStats) return 'Unknown';
    
    const percentage = this.getDailyUsagePercentage();
    if (percentage < 50) return 'Safe';
    if (percentage < 80) return 'Warning';
    if (percentage < 100) return 'Critical';
    return 'Limit Reached';
  }

  /**
   * Clear cache to free memory
   */
  clearCache(): void {
    this.deepseekService.clearCache();
    this.refreshUsageStats();
  }

  /**
   * Update cost control configuration
   */
  updateConfig(): void {
    if (!this.costConfig) return;
    
    // This would typically open a modal or form
    console.log('Update cost control configuration:', this.costConfig);
  }

  /**
   * Get estimated cost (if any)
   */
  getEstimatedCost(): string {
    if (!this.usageStats) return 'Unknown';
    
    // DeepSeek pricing (approximate)
    const tokensPerDollar = 1000000; // 1M tokens per $1 (approximate)
    const estimatedCost = this.usageStats.dailyUsage / tokensPerDollar;
    
    if (estimatedCost < 0.01) return 'Less than $0.01';
    return `$${estimatedCost.toFixed(4)}`;
  }

  /**
   * Check if service is available
   */
  isServiceAvailable(): boolean {
    return this.deepseekService.isAvailable();
  }
} 