import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-cosmic-background',
  template: `
    <div class="cosmic-background" [class]="getBackgroundClass()">
      <div class="cosmic-layer layer-1"></div>
      <div class="cosmic-layer layer-2"></div>
      <div class="cosmic-layer layer-3"></div>
      <div class="cosmic-gradient"></div>
    </div>
  `,
  styleUrls: ['./cosmic-background.component.sass']
})
export class CosmicBackgroundComponent implements OnChanges {
  @Input() analysisState: 'idle' | 'analyzing' | 'complete' = 'idle';
  @Input() keyDetected?: string;
  @Input() bpmDetected?: number;
  @Input() intensity: number = 1.0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['keyDetected'] || changes['analysisState']) {
      this.updateBackgroundProperties();
    }
  }

  getBackgroundClass(): string {
    let baseClass = 'cosmic-state-' + this.analysisState;
    
    if (this.keyDetected) {
      const key = this.keyDetected.split(' ')[0];
      baseClass += ' cosmic-key-' + key.toLowerCase().replace('#', 'sharp');
      const parts = this.keyDetected.toLowerCase().split(' ');
      const mode = parts[1] || 'major';
      baseClass += mode.includes('min') ? ' cosmic-mode-minor' : ' cosmic-mode-major';
    }
    
    return baseClass;
  }

  private updateBackgroundProperties(): void {
    const element = document.documentElement;
    
    // Set CSS custom properties for dynamic styling
    if (this.bpmDetected) {
      const normalizedSpeed = Math.max(0.5, Math.min(2.0, this.bpmDetected / 120));
      element.style.setProperty('--cosmic-speed', normalizedSpeed.toString());
    }
    
    element.style.setProperty('--cosmic-intensity', this.intensity.toString());
  }
}