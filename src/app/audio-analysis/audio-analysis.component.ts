import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { AudioFileHandlerService, AudioFileInfo } from '../audio-file-handler.service';

@Component({
  selector: 'app-audio-analysis',
  templateUrl: './audio-analysis.component.html',
  styleUrls: ['./audio-analysis.component.sass']
})
export class AudioAnalysisComponent implements OnInit, OnDestroy {
  @Input() audioFile: File | null = null;
  @Input() songTitle: string = '';
  @Input() songArtist: string = '';
  @Output() analysisComplete = new EventEmitter<any>();

  private destroy$ = new Subject<void>();
  
  isAnalyzing = false;
  analysisResult: any = null;
  error: string | null = null;
  progress = 0;
  analyzer: any = null;
  selectedAudioFileInfo: AudioFileInfo | null = null;

  constructor(private audioFileHandler: AudioFileHandlerService) { }

  ngOnInit() {
    this.initializeAnalyzer();
    this.subscribeToSelectedAudioFile();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Subscribe to selected audio file from the file handler
   */
  private subscribeToSelectedAudioFile(): void {
    this.audioFileHandler.selectedAudioFile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(audioFileInfo => {
        if (audioFileInfo) {
          this.selectedAudioFileInfo = audioFileInfo;
          this.audioFile = audioFileInfo.file;
          this.songTitle = audioFileInfo.title;
          this.songArtist = audioFileInfo.artist;
          
          // Update analysis status to analyzing
          this.audioFileHandler.updateAnalysisStatus(audioFileInfo.id, 'analyzing');
          
          console.log(`🎯 Audio file selected for analysis: ${audioFileInfo.title}`);

          // Auto-trigger analysis when analyzer and file are ready
          if (this.analyzer && this.audioFile) {
            void this.analyzeAudio();
          } else {
            // Retry shortly if analyzer not ready yet
            setTimeout(() => {
              if (this.analyzer && this.audioFile) {
                void this.analyzeAudio();
              }
            }, 300);
          }
        }
      });
  }

  /**
   * Initialize the Essentia.js professional analyzer
   */
  async initializeAnalyzer() {
    try {
      // Wait for EssentiaWASM to be available
      if (typeof (window as any).EssentiaWASM === 'undefined') {
        throw new Error('EssentiaWASM not loaded');
      }

      // Initialize analyzer
      const WasmModule = await (window as any).EssentiaWASM();
      this.analyzer = new (window as any).EssentiaProfessionalAnalyzer();
      
      console.log('✅ Essentia.js Professional Analyzer initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize analyzer:', error);
      this.error = 'Failed to initialize audio analyzer';
    }
  }

  /**
   * Start audio analysis
   */
  async analyzeAudio() {
    if (!this.audioFile || !this.analyzer) {
      this.error = 'Audio file or analyzer not available';
      return;
    }

    this.isAnalyzing = true;
    this.progress = 0;
    this.error = null;
    this.analysisResult = null;

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        this.progress += Math.random() * 15;
        if (this.progress >= 90) {
          clearInterval(progressInterval);
        }
      }, 200);

      // Perform analysis
      const result = await this.analyzer.analyzeSong(
        this.audioFile, 
        this.songTitle, 
        this.songArtist
      );

      clearInterval(progressInterval);
      this.progress = 100;

      // Process result
      this.analysisResult = result;
      this.analysisComplete.emit(result);

      // Update analysis status in file handler
      if (this.selectedAudioFileInfo) {
        this.audioFileHandler.updateAnalysisStatus(
          this.selectedAudioFileInfo.id, 
          'completed', 
          result
        );
      }

      console.log('🎵 Analysis completed:', result);

    } catch (error) {
      console.error('❌ Analysis failed:', error);
      this.error = 'Audio analysis failed. Please try again.';
      if (this.selectedAudioFileInfo) {
        this.audioFileHandler.updateAnalysisStatus(
          this.selectedAudioFileInfo.id,
          'failed'
        );
      }
    } finally {
      this.isAnalyzing = false;
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
   * Get method description
   */
  getMethodDescription(method: string): string {
    switch (method) {
      case 'essentia_analysis': return 'Essentia.js Professional Analysis';
      case 'essentia_analysis_fallback': return 'Essentia.js Analysis (Fallback)';
      case 'web_database': return 'Database Lookup';
      default: return 'Unknown Method';
    }
  }

  /**
   * Reset analysis
   */
  resetAnalysis() {
    this.analysisResult = null;
    this.error = null;
    this.progress = 0;
  }
} 