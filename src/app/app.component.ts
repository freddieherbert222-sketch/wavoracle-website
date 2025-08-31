import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DeepSeekAIService, AIInsight } from './deepseek-ai.service';
import { faTrashAlt, faCheckCircle, faTimesCircle, IconDefinition } from '@fortawesome/free-regular-svg-icons';
import { faRedoAlt, faSun, faMoon, faCircleHalfStroke, faCheck, faExternalLinkAlt, faDownload, faFileImport, faFileExport, faCopy, faClock, faTachometerAlt } from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { map, Observable, of, distinctUntilChanged } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';

import { Download, DownloadsService, Status } from './downloads.service';
import { MasterCheckboxComponent } from './master-checkbox.component';
import { Formats, Format, Quality } from './formats';
import { Theme, Themes } from './theme';
import { KeyValue } from "@angular/common";
import { AudioFileHandlerService, AudioFileInfo } from './audio-file-handler.service';
import { environment } from '../environments/environment';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.sass'],
    standalone: false
})
export class AppComponent implements AfterViewInit {
  environment = environment;
  addUrl: string;
  formats: Format[] = Formats.filter(f => ['mp3','wav','flac'].includes(f.id));
  qualities: Quality[];
  quality: string;
  format: string;
  folder: string;
  customNamePrefix: string;
  autoStart: boolean;
  playlistStrictMode: boolean;
  playlistItemLimit: number;
  addInProgress = false;
  themes: Theme[] = Themes;
  activeTheme: Theme;
  customDirs$: Observable<string[]>;
  showBatchPanel: boolean = false; 
  batchImportModalOpen = false;
  batchImportText = '';
  batchImportStatus = '';
  importInProgress = false;
  cancelImportFlag = false;
  ytDlpOptionsUpdateTime: string | null = null;
  ytDlpVersion: string | null = null;
  wavoracleVersion: string | null = null;
  isAdvancedOpen = false;
  urlWarning: string = '';

  // Audio Analysis properties
  selectedAudioFile: AudioFileInfo | null = null;
  selectedSongTitle: string = '';
  selectedSongArtist: string = '';
  audioAnalysisResult: any = null;

  // Download metrics
  activeDownloads = 0;
  queuedDownloads = 0;
  completedDownloads = 0;
  failedDownloads = 0;
  totalSpeed = 0;

  @ViewChild('queueMasterCheckbox') queueMasterCheckbox: MasterCheckboxComponent;
  @ViewChild('queueDelSelected') queueDelSelected: ElementRef;
  @ViewChild('queueDownloadSelected') queueDownloadSelected: ElementRef;
  @ViewChild('doneMasterCheckbox') doneMasterCheckbox: MasterCheckboxComponent;
  @ViewChild('doneDelSelected') doneDelSelected: ElementRef;
  @ViewChild('doneClearCompleted') doneClearCompleted: ElementRef;
  @ViewChild('doneClearFailed') doneClearFailed: ElementRef;
  @ViewChild('doneRetryFailed') doneRetryFailed: ElementRef;
  @ViewChild('doneDownloadSelected') doneDownloadSelected: ElementRef;
  @ViewChild('urlInput') urlInputRef: ElementRef<HTMLInputElement>;

  faTrashAlt = faTrashAlt;
  faCheckCircle = faCheckCircle;
  faTimesCircle = faTimesCircle;
  faRedoAlt = faRedoAlt;
  faSun = faSun;
  faMoon = faMoon;
  faCheck = faCheck;
  faCircleHalfStroke = faCircleHalfStroke;
  faDownload = faDownload;
  faExternalLinkAlt = faExternalLinkAlt;
  faFileImport = faFileImport;
  faFileExport = faFileExport;
  faCopy = faCopy;
  faGithub = faGithub;
  faClock = faClock;
  faTachometerAlt = faTachometerAlt;

  constructor(
    public downloads: DownloadsService, 
    private cookieService: CookieService, 
    private http: HttpClient,
    private audioFileHandler: AudioFileHandlerService,
    private aiService: DeepSeekAIService
  ) {
    const savedFormat = cookieService.get('wavoracle_format');
    this.format = this.formats.some(f => f.id === savedFormat) ? savedFormat : 'mp3';
    // Needs to be set or qualities won't automatically be set
    this.setQualities()
    this.quality = cookieService.get('wavoracle_quality') || 'best';
    this.autoStart = cookieService.get('wavoracle_auto_start') !== 'false';

    this.activeTheme = this.getPreferredTheme(cookieService);

    // Subscribe to download updates
    this.downloads.queueChanged.subscribe(() => {
      this.updateMetrics();
    });
    this.downloads.doneChanged.subscribe(() => {
      this.updateMetrics();
    });
    // Subscribe to real-time updates
    this.downloads.updated.subscribe(() => {
      this.updateMetrics();
    });

    // Subscribe to completed downloads for audio analysis
    this.downloads.doneChanged.subscribe(() => {
      this.processCompletedDownloads();
    });
  }

  // Enable download only after analysis finishes (completed or failed)
  canDownloadFor(download: Download): boolean {
    const status = this.audioFileHandler.getAnalysisStatus(download.id);
    return status === 'completed' || status === 'failed';
  }

  isAnalyzingFor(download: Download): boolean {
    const status = this.audioFileHandler.getAnalysisStatus(download.id);
    return status === 'analyzing' || status === 'pending';
  }

  ngOnInit() {
    this.getConfiguration();
    this.getYtdlOptionsUpdateTime();
    this.customDirs$ = this.getMatchingCustomDir();
    this.setTheme(this.activeTheme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.activeTheme.id === 'auto') {
         this.setTheme(this.activeTheme);
      }
    });
  }

  ngAfterViewInit() {
    this.downloads.queueChanged.subscribe(() => {
      this.queueMasterCheckbox.selectionChanged();
    });
    this.downloads.doneChanged.subscribe(() => {
      this.doneMasterCheckbox.selectionChanged();
      let completed: number = 0, failed: number = 0;
      this.downloads.done.forEach(dl => {
        if (dl.status === 'finished')
          completed++;
        else if (dl.status === 'error')
          failed++;
      });
      this.doneClearCompleted.nativeElement.disabled = completed === 0;
      this.doneClearFailed.nativeElement.disabled = failed === 0;
      this.doneRetryFailed.nativeElement.disabled = failed === 0;
    });
    this.fetchVersionInfo();
  }

  // workaround to allow fetching of Map values in the order they were inserted
  //  https://github.com/angular/angular/issues/31420
  asIsOrder(a, b) {
    return 1;
  }

  qualityChanged() {
    this.cookieService.set('wavoracle_quality', this.quality, { expires: 3650 });
    // Re-trigger custom directory change
    this.downloads.customDirsChanged.next(this.downloads.customDirs);
  }

  showAdvanced() {
    return this.downloads.configuration['CUSTOM_DIRS'];
  }

  allowCustomDir(tag: string) {
    if (this.downloads.configuration['CREATE_CUSTOM_DIRS']) {
      return tag;
    }
    return false;
  }

  isAudioType() {
    return this.quality == 'audio' || this.format == 'mp3'  || this.format == 'm4a' || this.format == 'opus' || this.format == 'wav' || this.format == 'flac';
  }

  getMatchingCustomDir() : Observable<string[]> {
    return this.downloads.customDirsChanged.asObservable().pipe(
      map((output) => {
        // Keep logic consistent with app/ytdl.py
        if (this.isAudioType()) {
          console.debug("Showing audio-specific download directories");
          return output["audio_download_dir"];
        } else {
          console.debug("Showing default download directories");
          return output["download_dir"];
        }
      }),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    );
  }

  getYtdlOptionsUpdateTime() {
    this.downloads.ytdlOptionsChanged.subscribe({
      next: (data) => {
        if (data['success']){
          const date = new Date(data['update_time'] * 1000);
          this.ytDlpOptionsUpdateTime=date.toLocaleString();
        }else{
          alert("Error reload yt-dlp options: "+data['msg']);
        }
      }
    });
  }

  getConfiguration() {
    this.downloads.configurationChanged.subscribe({
      next: (config) => {
        this.playlistStrictMode = config['DEFAULT_OPTION_PLAYLIST_STRICT_MODE'];
        const playlistItemLimit = config['DEFAULT_OPTION_PLAYLIST_ITEM_LIMIT'];
        if (playlistItemLimit !== '0') {
          this.playlistItemLimit = playlistItemLimit;
        }
      }
    });
  }

  getPreferredTheme(cookieService: CookieService) {
    let theme = 'auto';
    if (cookieService.check('wavoracle_theme')) {
      theme = cookieService.get('wavoracle_theme');
    }

    return this.themes.find(x => x.id === theme) ?? this.themes.find(x => x.id === 'auto');
  }

  themeChanged(theme: Theme) {
    this.cookieService.set('wavoracle_theme', theme.id, { expires: 3650 });
    this.setTheme(theme);
  }

  setTheme(theme: Theme) {
    this.activeTheme = theme;
    if (theme.id === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-bs-theme', theme.id);
    }
  }

  formatChanged() {
    this.cookieService.set('wavoracle_format', this.format, { expires: 3650 });
    // Updates to use qualities available
    this.setQualities()
    // Re-trigger custom directory change
    this.downloads.customDirsChanged.next(this.downloads.customDirs);
  }

  autoStartChanged() {
    this.cookieService.set('wavoracle_auto_start', this.autoStart ? 'true' : 'false', { expires: 3650 });
  }

  queueSelectionChanged(checked: number) {
    this.queueDelSelected.nativeElement.disabled = checked == 0;
    this.queueDownloadSelected.nativeElement.disabled = checked == 0;
  }

  doneSelectionChanged(checked: number) {
    this.doneDelSelected.nativeElement.disabled = checked == 0;
    this.doneDownloadSelected.nativeElement.disabled = checked == 0;
  }

  setQualities() {
    // qualities for specific format
    const selectedFormat = this.formats.find(el => el.id == this.format);
    this.qualities = selectedFormat ? selectedFormat.qualities : [];
    const exists = this.qualities.find(el => el.id === this.quality);
    this.quality = exists ? this.quality : (this.qualities[0]?.id || 'best');
  }

  addDownload(url?: string, quality?: string, format?: string, folder?: string, customNamePrefix?: string, playlistStrictMode?: boolean, playlistItemLimit?: number, autoStart?: boolean) {
    url = url ?? this.addUrl
    quality = quality ?? this.quality
    format = format ?? this.format
    folder = folder ?? this.folder
    customNamePrefix = customNamePrefix ?? this.customNamePrefix
    playlistStrictMode = playlistStrictMode ?? this.playlistStrictMode
    playlistItemLimit = playlistItemLimit ?? this.playlistItemLimit
    autoStart = autoStart ?? this.autoStart

    console.debug('Downloading: url='+url+' quality='+quality+' format='+format+' folder='+folder+' customNamePrefix='+customNamePrefix+' playlistStrictMode='+playlistStrictMode+' playlistItemLimit='+playlistItemLimit+' autoStart='+autoStart);
    this.addInProgress = true;
    this.urlWarning = '';

    // Optional preflight: enforce 60min/250MB if metadata is available
    this.downloads.probe(url).subscribe({
      next: (meta: any) => {
        const durationMin = meta?.duration_minutes;
        const sizeMb = meta?.size_mb;
        if ((durationMin && durationMin > 60) || (sizeMb && sizeMb > 250)) {
          this.urlWarning = 'This video exceeds limits (max 60 minutes or 250 MB). Please choose a shorter/smaller video.';
          this.addInProgress = false;
          return;
        }
        this._startAdd(url!, quality!, format!, folder!, customNamePrefix!, playlistStrictMode!, playlistItemLimit!, autoStart!);
      },
      error: () => {
        // If probe fails, proceed anyway (backend will enforce if needed)
        this._startAdd(url!, quality!, format!, folder!, customNamePrefix!, playlistStrictMode!, playlistItemLimit!, autoStart!);
      }
    });
  }

  private _startAdd(url: string, quality: string, format: string, folder: string, customNamePrefix: string, playlistStrictMode: boolean, playlistItemLimit: number, autoStart: boolean) {
    this.urlWarning = '';
    this.downloads.add(url, quality, format, folder, customNamePrefix, playlistStrictMode, playlistItemLimit, autoStart).subscribe({
      next: (status: Status) => {
        if (status.status === 'error') {
          console.warn('Add error:', status.msg);
          alert(`Error adding URL: ${status.msg}`);
        } else {
          this.addUrl = '';
          // If socket is slow, force-refresh history to show the new item
          this.downloads.fetchHistory();
        }
        this.addInProgress = false;
      },
      error: (err) => {
        console.error('Add request failed:', err);
        alert('Failed to add URL. Please try again.');
        this.addInProgress = false;
      }
    });
  }

  onUrlChange(_: string) {
    // Clear warnings when the user edits the URL
    if (this.urlWarning) this.urlWarning = '';
  }

  focusUrlInput() {
    try { this.urlInputRef?.nativeElement?.focus(); } catch {}
  }

  downloadItemByKey(id: string) {
    this.downloads.startById([id]).subscribe();
  }

  retryDownload(key: string, download: Download) {
    this.addDownload(download.url, download.quality, download.format, download.folder, download.custom_name_prefix, download.playlist_strict_mode, download.playlist_item_limit, true);
    this.downloads.delById('done', [key]).subscribe();
  }

  delDownload(where: string, id: string) {
    this.downloads.delById(where, [id]).subscribe();
  }

  startSelectedDownloads(where: string){
    this.downloads.startByFilter(where, dl => dl.checked).subscribe();
  }

  delSelectedDownloads(where: string) {
    this.downloads.delByFilter(where, dl => dl.checked).subscribe();
  }

  clearCompletedDownloads() {
    this.downloads.delByFilter('done', dl => dl.status === 'finished').subscribe();
  }

  clearFailedDownloads() {
    this.downloads.delByFilter('done', dl => dl.status === 'error').subscribe();
  }

  retryFailedDownloads() {
    this.downloads.done.forEach((dl, key) => {
      if (dl.status === 'error') {
        this.retryDownload(key, dl);
      }
    });
  }

  downloadSelectedFiles() {
    this.downloads.done.forEach((dl, key) => {
      if (dl.status === 'finished' && dl.checked) {
        const link = document.createElement('a');
        link.href = this.buildDownloadLink(dl);
        link.setAttribute('download', dl.filename);
        link.setAttribute('target', '_self');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  }

  buildDownloadLink(download: Download) {
    let baseDir = this.downloads.configuration["PUBLIC_HOST_URL"];
    if (
      download.quality == 'audio' ||
      (download.filename && (download.filename.endsWith('.mp3') || download.filename.endsWith('.wav') || download.filename.endsWith('.flac') || download.filename.endsWith('.m4a') || download.filename.endsWith('.opus')))
    ) {
      baseDir = this.downloads.configuration["PUBLIC_HOST_AUDIO_URL"];
    }

    if (download.folder) {
      baseDir += download.folder + '/';
    }

    return baseDir + encodeURIComponent(download.filename);
  }

  identifyDownloadRow(index: number, row: KeyValue<string, Download>) {
    return row.key;
  }

  isNumber(event) {
    const charCode = (event.which) ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
    }
  }

  // Toggle inline batch panel (if you want to use an inline panel for export; not used for import modal)
  toggleBatchPanel(): void {
    this.showBatchPanel = !this.showBatchPanel;
  }

  // Open the Batch Import modal
  openBatchImportModal(): void {
    this.batchImportModalOpen = true;
    this.batchImportText = '';
    this.batchImportStatus = '';
    this.importInProgress = false;
    this.cancelImportFlag = false;
  }

  // Close the Batch Import modal
  closeBatchImportModal(): void {
    this.batchImportModalOpen = false;
  }

  // Start importing URLs from the batch modal textarea
  startBatchImport(): void {
    const urls = this.batchImportText
      .split(/\r?\n/)
      .map(url => url.trim())
      .filter(url => url.length > 0);
    if (urls.length === 0) {
      alert('No valid URLs found.');
      return;
    }
    this.importInProgress = true;
    this.cancelImportFlag = false;
    this.batchImportStatus = `Starting to import ${urls.length} URLs...`;
    let index = 0;
    const delayBetween = 1000;
    const processNext = () => {
      if (this.cancelImportFlag) {
        this.batchImportStatus = `Import cancelled after ${index} of ${urls.length} URLs.`;
        this.importInProgress = false;
        return;
      }
      if (index >= urls.length) {
        this.batchImportStatus = `Finished importing ${urls.length} URLs.`;
        this.importInProgress = false;
        return;
      }
      const url = urls[index];
      this.batchImportStatus = `Importing URL ${index + 1} of ${urls.length}: ${url}`;
      // Now pass the selected quality, format, folder, etc. to the add() method
      this.downloads.add(url, this.quality, this.format, this.folder, this.customNamePrefix,
        this.playlistStrictMode, this.playlistItemLimit, this.autoStart)
        .subscribe({
          next: (status: Status) => {
            if (status.status === 'error') {
              alert(`Error adding URL ${url}: ${status.msg}`);
            }
            index++;
            setTimeout(processNext, delayBetween);
          },
          error: (err) => {
            console.error(`Error importing URL ${url}:`, err);
            index++;
            setTimeout(processNext, delayBetween);
          }
        });
    };
    processNext();
  }

  // Cancel the batch import process
  cancelBatchImport(): void {
    if (this.importInProgress) {
      this.cancelImportFlag = true;
      this.batchImportStatus += ' Cancelling...';
    }
  }

  // Export URLs based on filter: 'pending', 'completed', 'failed', or 'all'
  exportBatchUrls(filter: 'pending' | 'completed' | 'failed' | 'all'): void {
    let urls: string[];
    if (filter === 'pending') {
      urls = Array.from(this.downloads.queue.values()).map(dl => dl.url);
    } else if (filter === 'completed') {
      // Only finished downloads in the "done" Map
      urls = Array.from(this.downloads.done.values()).filter(dl => dl.status === 'finished').map(dl => dl.url);
    } else if (filter === 'failed') {
      // Only error downloads from the "done" Map
      urls = Array.from(this.downloads.done.values()).filter(dl => dl.status === 'error').map(dl => dl.url);
    } else {
      // All: pending + both finished and error in done
      urls = [
        ...Array.from(this.downloads.queue.values()).map(dl => dl.url),
        ...Array.from(this.downloads.done.values()).map(dl => dl.url)
      ];
    }
    if (!urls.length) {
      alert('No URLs found for the selected filter.');
      return;
    }
    const content = urls.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'wavoracle_urls.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  }

  // Copy URLs to clipboard based on filter: 'pending', 'completed', 'failed', or 'all'
  copyBatchUrls(filter: 'pending' | 'completed' | 'failed' | 'all'): void {
    let urls: string[];
    if (filter === 'pending') {
      urls = Array.from(this.downloads.queue.values()).map(dl => dl.url);
    } else if (filter === 'completed') {
      urls = Array.from(this.downloads.done.values()).filter(dl => dl.status === 'finished').map(dl => dl.url);
    } else if (filter === 'failed') {
      urls = Array.from(this.downloads.done.values()).filter(dl => dl.status === 'error').map(dl => dl.url);
    } else {
      urls = [
        ...Array.from(this.downloads.queue.values()).map(dl => dl.url),
        ...Array.from(this.downloads.done.values()).map(dl => dl.url)
      ];
    }
    if (!urls.length) {
      alert('No URLs found for the selected filter.');
      return;
    }
    const content = urls.join('\n');
    navigator.clipboard.writeText(content)
      .then(() => alert('URLs copied to clipboard.'))
      .catch(() => alert('Failed to copy URLs.'));
  }

  fetchVersionInfo(): void {
    const baseUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^\/]*$/, '/')}`;
    const versionUrl = `${baseUrl}version`;
    this.http.get<{ 'yt-dlp': string, version: string }>(versionUrl)
      .subscribe({
        next: (data) => {
          this.ytDlpVersion = data['yt-dlp'];
          this.wavoracleVersion = data.version;
        },
        error: () => {
          this.ytDlpVersion = null;
          this.wavoracleVersion = null;
        }
      });
  }

  toggleAdvanced() {
    this.isAdvancedOpen = !this.isAdvancedOpen;
  }

  private updateMetrics() {
    this.activeDownloads = Array.from(this.downloads.queue.values()).filter(d => d.status === 'downloading' || d.status === 'preparing').length;
    this.queuedDownloads = Array.from(this.downloads.queue.values()).filter(d => d.status === 'pending').length;
    this.completedDownloads = Array.from(this.downloads.queue.values()).filter(d => d.status === 'finished').length;
    this.failedDownloads = Array.from(this.downloads.queue.values()).filter(d => d.status === 'error').length;
    
    // Calculate total speed from downloading items
    const downloadingItems = Array.from(this.downloads.queue.values())
      .filter(d => d.status === 'downloading');
    
    this.totalSpeed = downloadingItems.reduce((total, item) => total + (item.speed || 0), 0);
  }

  // Audio Analysis Methods
  onAnalysisComplete(result: any): void {
    console.log('🎵 Audio analysis completed:', result);
    
    // Store the result for AI insights
    this.audioAnalysisResult = result;
    
    // Update the analysis status in the audio file handler
    if (this.selectedAudioFile) {
      this.audioFileHandler.updateAnalysisStatus(
        this.selectedAudioFile.id, 
        'completed', 
        result
      );
    }

    // Trigger AI insights (non-blocking)
    const titleForAI = this.selectedSongTitle || this.selectedAudioFile?.title || '';
    if (titleForAI && this.aiService.isConfigured()) {
      this.aiService.generateMusicalInsights(titleForAI, result)
        .then((insight: AIInsight) => {
          // TODO: emit into AI insights component via an input or shared service if needed
          console.log('🧠 AI insights:', insight);
        })
        .catch(err => console.warn('AI insights failed:', err));
    }
  }

  // Method to set audio file for analysis (called when user selects a file)
  setAudioFileForAnalysis(audioFileInfo: AudioFileInfo): void {
    this.selectedAudioFile = audioFileInfo;
    this.selectedSongTitle = audioFileInfo.title;
    this.selectedSongArtist = audioFileInfo.artist;
  }

  // Process completed downloads for audio analysis
  private async processCompletedDownloads(): Promise<void> {
    const completedDownloads = Array.from(this.downloads.done.values());
    
    for (const download of completedDownloads) {
      // Check if we've already processed this download
      const existingFiles = this.audioFileHandler.getAllAudioFiles();
      const alreadyProcessed = existingFiles.some(f => f.id === download.id);
      
      if (!alreadyProcessed) {
        console.log(`🔄 Processing completed download: ${download.title}`);
        const fileInfo = await this.audioFileHandler.processCompletedDownload(download);
        if (fileInfo) {
          // Immediately select file to trigger analysis flow
          this.audioFileHandler.selectAudioFile(fileInfo);
          this.setAudioFileForAnalysis(fileInfo);
        }
      }
    }
  }

  // Method to determine the current analysis state for the animated background
  getAnalysisState(): 'idle' | 'analyzing' | 'complete' {
    if (this.addInProgress) {
      return 'analyzing';
    }
    
    const keyVal = this.audioAnalysisResult?.key || this.audioAnalysisResult?.finalResult?.key;
    const bpmVal = this.audioAnalysisResult?.bpm || this.audioAnalysisResult?.finalResult?.bpm;
    if (keyVal && bpmVal) {
      return 'complete';
    }
    
    return 'idle';
  }

  // Format and Quality Selection Methods
  selectFormat(formatId: string): void {
    this.format = formatId;
    this.formatChanged();
    // Update qualities for the selected format
    const selectedFormat = this.formats.find(f => f.id === formatId);
    if (selectedFormat) {
      this.qualities = selectedFormat.qualities;
      // Set default quality for the format
      if (!this.qualities.some(q => q.id === this.quality)) {
        this.quality = this.qualities[0]?.id || 'best';
        this.qualityChanged();
      }
    }
  }

  selectQuality(qualityId: string): void {
    this.quality = qualityId;
    this.qualityChanged();
  }

  // Download Table Helper Methods
  getFormatFromDownload(download: any): string {
    // Extract format from filename or use quality setting
    if (download.filename) {
      const extension = download.filename.split('.').pop()?.toUpperCase();
      return extension || 'UNKNOWN';
    }
    return this.format?.toUpperCase() || 'UNKNOWN';
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'finished': return 'status-success';
      case 'error': return 'status-error';
      case 'downloading': return 'status-progress';
      case 'preparing': return 'status-preparing';
      case 'pending': return 'status-pending';
      default: return 'status-default';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'finished': return 'Completed';
      case 'error': return 'Failed';
      case 'downloading': return 'Downloading';
      case 'preparing': return 'Preparing';
      case 'pending': return 'Queued';
      default: return status;
    }
  }

  viewDownload(url: string): void {
    window.open(url, '_blank');
  }

  hasAnyDownloads(): boolean {
    const queueLength = this.downloads.queue ? Object.keys(this.downloads.queue).length : 0;
    const doneLength = this.downloads.done ? Object.keys(this.downloads.done).length : 0;
    return queueLength > 0 || doneLength > 0;
  }

  isAudioFormat(): boolean {
    const audioFormats = ['mp3', 'wav', 'flac'];
    return audioFormats.includes(this.format);
  }

  // Show quality options only when the selected format provides meaningful choices
  shouldShowQuality(): boolean {
    const selected = this.formats.find(f => f.id === this.format);
    return !!selected && Array.isArray(selected.qualities) && selected.qualities.length > 1;
  }
}
