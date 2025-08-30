import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { AudioFileHandlerService, AudioFileInfo } from '../audio-file-handler.service';

@Component({
  selector: 'app-audio-file-selector',
  templateUrl: './audio-file-selector.component.html',
  styleUrls: ['./audio-file-selector.component.sass']
})
export class AudioFileSelectorComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  audioFiles: AudioFileInfo[] = [];
  selectedFile: AudioFileInfo | null = null;
  isLoading = false;

  constructor(private audioFileHandler: AudioFileHandlerService) {}

  ngOnInit(): void {
    this.subscribeToAudioFiles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Subscribe to audio files updates
   */
  private subscribeToAudioFiles(): void {
    this.audioFileHandler.audioFiles$
      .pipe(takeUntil(this.destroy$))
      .subscribe(files => {
        this.audioFiles = files;
        console.log(`📁 Audio files updated: ${files.length} files available`);
      });

    this.audioFileHandler.selectedAudioFile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(file => {
        this.selectedFile = file;
      });
  }

  /**
   * Select an audio file for analysis
   */
  selectFile(audioFile: AudioFileInfo): void {
    this.audioFileHandler.selectAudioFile(audioFile);
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(status: AudioFileInfo['analysisStatus']): string {
    switch (status) {
      case 'pending': return 'badge-secondary';
      case 'analyzing': return 'badge-warning';
      case 'completed': return 'badge-success';
      case 'failed': return 'badge-danger';
      default: return 'badge-secondary';
    }
  }

  /**
   * Get status icon
   */
  getStatusIcon(status: AudioFileInfo['analysisStatus']): string {
    switch (status) {
      case 'pending': return '⏳';
      case 'analyzing': return '🔍';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '❓';
    }
  }

  /**
   * Get format badge class
   */
  getFormatBadgeClass(format: string): string {
    const formatClasses: { [key: string]: string } = {
      'mp3': 'badge-info',
      'wav': 'badge-primary',
      'flac': 'badge-success',
      'aac': 'badge-warning',
      'ogg': 'badge-secondary',
      'm4a': 'badge-dark'
    };
    return formatClasses[format.toLowerCase()] || 'badge-secondary';
  }

  /**
   * Get quality badge class
   */
  getQualityBadgeClass(quality: string): string {
    if (quality.includes('best')) return 'badge-success';
    if (quality.includes('worst')) return 'badge-danger';
    return 'badge-info';
  }

  /**
   * Format duration in MM:SS
   */
  formatDuration(seconds: number): string {
    if (!seconds) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Format download date
   */
  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  /**
   * Check if file is selected
   */
  isFileSelected(audioFile: AudioFileInfo): boolean {
    return this.selectedFile?.id === audioFile.id;
  }

  /**
   * Get file size in readable format
   */
  getFileSize(file: AudioFileInfo): string {
    // This would need to be implemented with actual file size
    // For now, return a placeholder
    return '-- MB';
  }

  /**
   * Remove audio file from list
   */
  removeFile(fileId: string): void {
    this.audioFileHandler.removeAudioFile(fileId);
  }

  /**
   * Clear all audio files
   */
  clearAllFiles(): void {
    this.audioFileHandler.clearAllAudioFiles();
  }

  /**
   * Get files by status
   */
  getFilesByStatus(status: AudioFileInfo['analysisStatus']): AudioFileInfo[] {
    return this.audioFiles.filter(f => f.analysisStatus === status);
  }

  /**
   * Get pending files count
   */
  getPendingCount(): number {
    return this.getFilesByStatus('pending').length;
  }

  /**
   * Get completed files count
   */
  getCompletedCount(): number {
    return this.getFilesByStatus('completed').length;
  }

  /**
   * Get failed files count
   */
  getFailedCount(): number {
    return this.getFilesByStatus('failed').length;
  }

  // Track by function for ngFor optimization
  trackByFileId(index: number, audioFile: AudioFileInfo): string {
    return audioFile.id;
  }

  /**
   * Get standardized download filename
   */
  getDownloadFilename(audioFile: AudioFileInfo): string {
    return this.audioFileHandler.getDownloadFilename(audioFile);
  }
} 