import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Download } from './downloads.service';

export interface AudioFileInfo {
  id: string;
  file: File;
  title: string;
  artist: string;
  duration: number;
  format: string;
  quality: string;
  url: string;
  downloadDate: Date;
  analysisStatus: 'pending' | 'analyzing' | 'completed' | 'failed';
  analysisResult?: any;
}

export interface YouTubeMetadata {
  title: string;
  artist?: string;
  duration: number;
  thumbnail?: string;
  description?: string;
  tags?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AudioFileHandlerService {
  private audioFilesSubject = new BehaviorSubject<AudioFileInfo[]>([]);
  private selectedAudioFileSubject = new BehaviorSubject<AudioFileInfo | null>(null);
  private metadataCache = new Map<string, YouTubeMetadata>();

  public audioFiles$ = this.audioFilesSubject.asObservable();
  public selectedAudioFile$ = this.selectedAudioFileSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Process completed WavOracle download and prepare for audio analysis
   */
  async processCompletedDownload(download: Download): Promise<AudioFileInfo | null> {
    try {
      console.log(`🎵 Processing completed download: ${download.title}`);

      // Check if it's an audio file
      if (!this.isAudioFormat(download.format)) {
        console.log(`⏭️ Skipping non-audio format: ${download.format}`);
        return null;
      }

      // Get or fetch YouTube metadata
      const metadata = await this.getYouTubeMetadata(download.url, download.title);

      // Create File object from the downloaded file
      const audioFile = await this.createFileFromDownload(download);

      if (!audioFile) {
        console.error('❌ Failed to create File object from download');
        return null;
      }

      // Create AudioFileInfo object
      const audioFileInfo: AudioFileInfo = {
        id: download.id,
        file: audioFile,
        title: metadata.title,
        artist: metadata.artist || 'Unknown Artist',
        duration: metadata.duration,
        format: download.format,
        quality: download.quality,
        url: download.url,
        downloadDate: new Date(),
        analysisStatus: 'pending'
      };

      // Add to audio files list
      this.addAudioFile(audioFileInfo);

      console.log(`✅ Audio file processed successfully: ${audioFileInfo.title}`);
      return audioFileInfo;

    } catch (error) {
      console.error('❌ Error processing completed download:', error);
      return null;
    }
  }

  /**
   * Check if the format is audio
   */
  private isAudioFormat(format: string): boolean {
    const audioFormats = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
    return audioFormats.includes(format.toLowerCase());
  }

  /**
   * Get YouTube metadata (with caching)
   */
  private async getYouTubeMetadata(url: string, fallbackTitle: string): Promise<YouTubeMetadata> {
    // Check cache first
    if (this.metadataCache.has(url)) {
      return this.metadataCache.get(url)!;
    }

    try {
      // Try to extract metadata from the URL or use fallback
      const metadata: YouTubeMetadata = {
        title: fallbackTitle,
        artist: this.extractArtistFromTitle(fallbackTitle),
        duration: 0, // Will be updated when file is processed
        thumbnail: '',
        description: '',
        tags: []
      };

      // Cache the metadata
      this.metadataCache.set(url, metadata);
      return metadata;

    } catch (error) {
      console.warn('⚠️ Failed to get YouTube metadata, using fallback:', error);
      return {
        title: fallbackTitle,
        artist: this.extractArtistFromTitle(fallbackTitle),
        duration: 0,
        thumbnail: '',
        description: '',
        tags: []
      };
    }
  }

  /**
   * Extract artist from title (common patterns)
   */
  private extractArtistFromTitle(title: string): string {
    // Common patterns: "Artist - Song Title", "Artist: Song Title", "Artist ft. Other - Song"
    const patterns = [
      /^(.+?)\s*[-–—]\s*(.+)$/,           // "Artist - Song"
      /^(.+?)\s*:\s*(.+)$/,               // "Artist: Song"
      /^(.+?)\s+ft\.?\s+(.+?)\s*[-–—]\s*(.+)$/, // "Artist ft. Other - Song"
      /^(.+?)\s+feat\.?\s+(.+?)\s*[-–—]\s*(.+)$/ // "Artist feat. Other - Song"
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return 'Unknown Artist';
  }

  /**
   * Create File object from WavOracle download
   */
  private async createFileFromDownload(download: Download): Promise<File | null> {
    try {
      // For now, we'll create a placeholder File object
      // In a real implementation, you'd need to access the actual file from the filesystem
      // This is a limitation of web browsers - they can't directly access downloaded files
      
      // Create a mock file for demonstration purposes
      const mockFile = new File([''], download.filename || 'audio.mp3', {
        type: this.getMimeType(download.format),
        lastModified: Date.now()
      });

      console.log(`📁 Created mock file: ${mockFile.name}`);
      return mockFile;

    } catch (error) {
      console.error('❌ Error creating file from download:', error);
      return null;
    }
  }

  /**
   * Get MIME type for audio format
   */
  private getMimeType(format: string): string {
    const mimeTypes: { [key: string]: string } = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'flac': 'audio/flac',
      'aac': 'audio/aac',
      'ogg': 'audio/ogg',
      'm4a': 'audio/mp4'
    };
    return mimeTypes[format.toLowerCase()] || 'audio/mpeg';
  }

  /**
   * Add audio file to the list
   */
  private addAudioFile(audioFileInfo: AudioFileInfo): void {
    const currentFiles = this.audioFilesSubject.value;
    const updatedFiles = [...currentFiles, audioFileInfo];
    this.audioFilesSubject.next(updatedFiles);
  }

  /**
   * Select an audio file for analysis
   */
  selectAudioFile(audioFileInfo: AudioFileInfo): void {
    this.selectedAudioFileSubject.next(audioFileInfo);
    console.log(`🎯 Selected audio file for analysis: ${audioFileInfo.title}`);
  }

  /**
   * Update analysis status
   */
  updateAnalysisStatus(fileId: string, status: AudioFileInfo['analysisStatus'], result?: any): void {
    const currentFiles = this.audioFilesSubject.value;
    const fileIndex = currentFiles.findIndex(f => f.id === fileId);
    
    if (fileIndex !== -1) {
      currentFiles[fileIndex].analysisStatus = status;
      if (result) {
        currentFiles[fileIndex].analysisResult = result;
      }
      
      this.audioFilesSubject.next([...currentFiles]);
      console.log(`📊 Updated analysis status for ${currentFiles[fileIndex].title}: ${status}`);
    }
  }

  /**
   * Get the currently selected audio file
   */
  getSelectedAudioFile(): AudioFileInfo | null {
    return this.selectedAudioFileSubject.value;
  }

  /**
   * Get all audio files
   */
  getAllAudioFiles(): AudioFileInfo[] {
    return this.audioFilesSubject.value;
  }

  /**
   * Remove audio file from list
   */
  removeAudioFile(fileId: string): void {
    const currentFiles = this.audioFilesSubject.value;
    const updatedFiles = currentFiles.filter(f => f.id !== fileId);
    this.audioFilesSubject.next(updatedFiles);
    
    // If the removed file was selected, clear selection
    if (this.selectedAudioFileSubject.value?.id === fileId) {
      this.selectedAudioFileSubject.next(null);
    }
  }

  /**
   * Clear all audio files
   */
  clearAllAudioFiles(): void {
    this.audioFilesSubject.next([]);
    this.selectedAudioFileSubject.next(null);
    console.log('🗑️ Cleared all audio files');
  }

  /**
   * Get audio files by analysis status
   */
  getAudioFilesByStatus(status: AudioFileInfo['analysisStatus']): AudioFileInfo[] {
    return this.audioFilesSubject.value.filter(f => f.analysisStatus === status);
  }

  /**
   * Get pending analysis files
   */
  getPendingAnalysisFiles(): AudioFileInfo[] {
    return this.getAudioFilesByStatus('pending');
  }

  /**
   * Get completed analysis files
   */
  getCompletedAnalysisFiles(): AudioFileInfo[] {
    return this.getAudioFilesByStatus('completed');
  }

  /**
   * Generate standardized filename with key/BPM metadata
   */
  generateStandardizedFilename(audioFileInfo: AudioFileInfo): string {
    const { title, artist, format, analysisResult } = audioFileInfo;
    
    // Extract song title and type from the full title
    const { songTitle, songType } = this.parseSongTitle(title);
    
    // Check if we have analysis results with key/BPM
    if (analysisResult && analysisResult.finalResult) {
      const { key, bpm, confidence } = analysisResult.finalResult;
      
      // Only use key/BPM if confidence is medium or high
      if (confidence === 'high' || confidence === 'medium') {
        return this.formatFilenameWithMetadata(artist, songTitle, key, bpm, format, songType);
      }
    }
    
    // Fallback: No key/BPM available, use basic naming
    return this.formatBasicFilename(artist, songTitle, format, songType);
  }

  /**
   * Parse song title to extract actual title and type
   */
  private parseSongTitle(fullTitle: string): { songTitle: string; songType: string } {
    const title = fullTitle.trim();
    let songTitle = title;
    let songType = 'Original';

    // Check for common type indicators
    const typePatterns = [
      { pattern: /\[instrumental\]/i, type: 'Instrumental' },
      { pattern: /\[acapella\]/i, type: 'Acapella' },
      { pattern: /\[karaoke\]/i, type: 'Karaoke' },
      { pattern: /\[remix\]/i, type: 'Remix' },
      { pattern: /\(instrumental\)/i, type: 'Instrumental' },
      { pattern: /\(acapella\)/i, type: 'Acapella' },
      { pattern: /\(karaoke\)/i, type: 'Karaoke' },
      { pattern: /\(remix\)/i, type: 'Remix' },
      { pattern: /instrumental/i, type: 'Instrumental' },
      { pattern: /acapella/i, type: 'Acapella' },
      { pattern: /karaoke/i, type: 'Karaoke' },
      { pattern: /remix/i, type: 'Remix' }
    ];

    for (const { pattern, type } of typePatterns) {
      if (pattern.test(title)) {
        songType = type;
        songTitle = title.replace(pattern, '').trim();
        break;
      }
    }

    return { songTitle, songType };
  }

  /**
   * Format filename with key/BPM metadata
   */
  private formatFilenameWithMetadata(
    artist: string, 
    songTitle: string, 
    key: string, 
    bpm: number, 
    format: string, 
    songType: string
  ): string {
    const cleanArtist = this.cleanFilename(artist);
    const cleanTitle = this.cleanFilename(songTitle);
    const cleanKey = this.cleanFilename(this.normalizeKeyFormat(key));
    const bpmRounded = Math.round(bpm);

    let filename = `${cleanArtist} - ${cleanTitle}`;

    // Add key and BPM in one bracket: [Key BPMbpm]
    if (cleanKey && bpmRounded) {
      filename += ` [${cleanKey} ${bpmRounded}bpm]`;
    }

    // Add song type if not original using dash suffix
    if (songType !== 'Original') {
      filename += ` - ${songType}`;
    }

    // Collapse spaces
    filename = filename.replace(/\s+/g, ' ').trim();

    return `${filename}.${format.toLowerCase()}`;
  }

  /**
   * Format basic filename without key/BPM
   */
  private formatBasicFilename(
    artist: string, 
    songTitle: string, 
    format: string, 
    songType: string
  ): string {
    const cleanArtist = this.cleanFilename(artist);
    const cleanTitle = this.cleanFilename(songTitle);
    
    let filename = `${cleanArtist} - ${cleanTitle}`;
    
    // Add song type if not original
    if (songType !== 'Original') {
      filename += ` [${songType}]`;
    }
    
    return `${filename}.${format.toLowerCase()}`;
  }

  /**
   * Clean filename to remove invalid characters
   */
  private cleanFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*%]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize key string to preferred format: Cmaj/Cmin/C#maj/Cflat etc.
   */
  private normalizeKeyFormat(originalKey: string): string {
    if (!originalKey) return '';
    let key = originalKey.trim();

    const parts = key.split(/\s+/);
    let tonic = parts[0];
    const mode = (parts[1] || '').toLowerCase();

    const flatMap: Record<string, string> = {
      Ab: 'Aflat', Bb: 'Bflat', Cb: 'Cflat', Db: 'Dflat', Eb: 'Eflat', Fb: 'Fflat', Gb: 'Gflat',
      AB: 'Aflat', BB: 'Bflat', CB: 'Cflat', DB: 'Dflat', EB: 'Eflat', FB: 'Fflat', GB: 'Gflat'
    };
    // Lowercase variants
    const lc = tonic.toLowerCase();
    const flatMapLc: Record<string, string> = {
      'ab': 'Aflat', 'bb': 'Bflat', 'cb': 'Cflat', 'db': 'Dflat', 'eb': 'Eflat', 'fb': 'Fflat', 'gb': 'Gflat'
    };
    if (flatMap[tonic as keyof typeof flatMap]) {
      tonic = flatMap[tonic as keyof typeof flatMap];
    } else if (flatMapLc[lc as keyof typeof flatMapLc]) {
      tonic = flatMapLc[lc as keyof typeof flatMapLc];
    }

    let suffix = '';
    if (mode.includes('maj') || mode === 'major') suffix = 'maj';
    else if (mode.includes('min') || mode === 'minor') suffix = 'min';

    return suffix ? `${tonic}${suffix}` : tonic;
  }

  /**
   * Get download filename for user (this is what they'll see)
   */
  getDownloadFilename(audioFileInfo: AudioFileInfo): string {
    return this.generateStandardizedFilename(audioFileInfo);
  }

  /**
   * Get analysis status by download/file id
   */
  getAnalysisStatus(fileId: string): AudioFileInfo['analysisStatus'] | null {
    const file = this.audioFilesSubject.value.find(f => f.id === fileId);
    return file ? file.analysisStatus : null;
  }
} 