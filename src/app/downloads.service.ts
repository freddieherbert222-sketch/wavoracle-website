import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, Subject } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { WavOracleSocket } from './wavoracle-socket';

export interface Status {
  status: string;
  msg?: string;
}

export interface Download {
  id: string;
  title: string;
  url: string;
  quality: string;
  format: string;
  folder: string;
  custom_name_prefix: string;
  playlist_strict_mode: boolean;
  playlist_item_limit: number;
  status: string;
  msg: string;
  percent: number;
  speed: number;
  eta: number;
  filename: string;
  checked?: boolean;
  deleting?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DownloadsService {
  loading = true;
  queue = new Map<string, Download>();
  done = new Map<string, Download>();
  queueChanged = new Subject();
  doneChanged = new Subject();
  customDirsChanged = new Subject();
  ytdlOptionsChanged = new Subject();
  configurationChanged = new Subject();
  updated = new Subject();

  configuration = {};
  customDirs = {};
  private lastSocketUpdate = Date.now();
  private historyPollIntervalMs = 10000; // 10s

  constructor(private http: HttpClient, private socket: WavOracleSocket) {
    // Defer socket initialization to prevent bootstrap failures
    setTimeout(() => {
      this.safeInitializeSocketSubscriptions();
    }, 100);

    // Fallback: if socket never connects, clear loading so UI remains usable
    setTimeout(() => {
      if (this.loading) {
        console.warn('Socket not connected yet; enabling UI without live queue');
        this.fetchHistory();
      }
    }, 3000);

    // Periodic lightweight HTTP polling as resilience when socket is stale
    setInterval(() => {
      const msSinceUpdate = Date.now() - this.lastSocketUpdate;
      if (msSinceUpdate > 15000) { // stale beyond 15s
        this.fetchHistory();
      }
    }, this.historyPollIntervalMs);
  }

  /**
   * HTTP fallback: fetch current queue/done/pending state when socket is unavailable
   */
  public fetchHistory(): void {
    this.http.get<{ done: Download[]; queue: Download[]; pending: Download[] }>('history')
      .pipe(catchError(this.handleHTTPError))
      .subscribe((res: any) => {
        try {
          if (!res || res.status === 'error') {
            console.warn('History fetch failed:', res?.msg || res);
            this.loading = false;
            this.queueChanged.next(null);
            this.doneChanged.next(null);
            return;
          }
          // Normalize Maps
          this.queue.clear();
          (res.queue || []).forEach((d: Download) => this.queue.set(d.url, d));
          (res.pending || []).forEach((d: Download) => this.queue.set(d.url, d));
          this.done.clear();
          (res.done || []).forEach((d: Download) => this.done.set(d.url, d));
          this.loading = false;
          this.queueChanged.next(null);
          this.doneChanged.next(null);
        } catch (e) {
          console.error('Failed to process history response', e);
          this.loading = false;
          this.queueChanged.next(null);
          this.doneChanged.next(null);
        }
      });
  }

  private safeInitializeSocketSubscriptions() {
    try {
      // Double-check socket availability
      if (!this.socket || typeof this.socket.fromEvent !== 'function') {
        console.warn('Socket service not available, skipping initialization');
        return;
      }

      console.log('Initializing socket subscriptions...');

      // Safe subscription with error boundaries
      this.safeSubscribe('all', (strdata: string) => {
        try {
          this.loading = false;
          let data: [[[string, Download]], [[string, Download]]] = JSON.parse(strdata);
          this.queue.clear();
          data[0]?.forEach(entry => this.queue.set(...entry));
          this.done.clear();
          data[1]?.forEach(entry => this.done.set(...entry));
          this.queueChanged.next(null);
          this.doneChanged.next(null);
          this.lastSocketUpdate = Date.now();
        } catch (error) {
          console.error('Error processing "all" event:', error);
        }
      });

      this.safeSubscribe('added', (strdata: string) => {
        try {
          let data: Download = JSON.parse(strdata);
          this.queue.set(data.url, data);
          this.queueChanged.next(null);
        } catch (error) {
          console.error('Error processing "added" event:', error);
        }
      });

      this.safeSubscribe('updated', (strdata: string) => {
        try {
          let data: Download = JSON.parse(strdata);
          let dl: Download = this.queue.get(data.url);
          data.checked = dl?.checked;
          data.deleting = dl?.deleting;
          this.queue.set(data.url, data);
          this.updated.next(null);
          this.lastSocketUpdate = Date.now();
        } catch (error) {
          console.error('Error processing "updated" event:', error);
        }
      });

      this.safeSubscribe('completed', (strdata: string) => {
        try {
          let data: Download = JSON.parse(strdata);
          this.queue.delete(data.url);
          this.done.set(data.url, data);
          this.queueChanged.next(null);
          this.doneChanged.next(null);
          this.lastSocketUpdate = Date.now();
        } catch (error) {
          console.error('Error processing "completed" event:', error);
        }
      });

      this.safeSubscribe('canceled', (strdata: string) => {
        try {
          let data: string = JSON.parse(strdata);
          this.queue.delete(data);
          this.queueChanged.next(null);
        } catch (error) {
          console.error('Error processing "canceled" event:', error);
        }
      });

      this.safeSubscribe('cleared', (strdata: string) => {
        try {
          let data: string = JSON.parse(strdata);
          this.done.delete(data);
          this.doneChanged.next(null);
        } catch (error) {
          console.error('Error processing "cleared" event:', error);
        }
      });

      this.safeSubscribe('configuration', (strdata: string) => {
        try {
          let data = JSON.parse(strdata);
          console.debug("got configuration:", data);
          this.configuration = data;
          this.configurationChanged.next(data);
        } catch (error) {
          console.error('Error processing "configuration" event:', error);
        }
      });

      this.safeSubscribe('custom_dirs', (strdata: string) => {
        try {
          let data = JSON.parse(strdata);
          console.debug("got custom_dirs:", data);
          this.customDirs = data;
          this.customDirsChanged.next(data);
        } catch (error) {
          console.error('Error processing "custom_dirs" event:', error);
        }
      });

      this.safeSubscribe('ytdl_options_changed', (strdata: string) => {
        try {
          let data = JSON.parse(strdata);
          this.ytdlOptionsChanged.next(data);
        } catch (error) {
          console.error('Error processing "ytdl_options_changed" event:', error);
        }
      });

      console.log('Socket subscriptions initialized successfully');

    } catch (error) {
      console.error('Failed to initialize socket subscriptions:', error);
      // Don't throw - let the service continue without socket functionality
    }
  }

  private safeSubscribe(event: string, callback: (data: any) => void) {
    try {
      if (!this.socket || !this.socket.fromEvent) {
        console.warn(`Socket not available for event: ${event}`);
        return;
      }

      this.socket.fromEvent(event).subscribe({
        next: callback,
        error: (error) => {
          console.error(`Socket error for event "${event}":`, error);
        }
      });
    } catch (error) {
      console.error(`Failed to subscribe to event "${event}":`, error);
    }
  }

  handleHTTPError(error: HttpErrorResponse) {
    var msg = error.error instanceof ErrorEvent ? error.error.message : error.error;
    return of({status: 'error', msg: msg})
  }

  public add(url: string, quality: string, format: string, folder: string, customNamePrefix: string, playlistStrictMode: boolean, playlistItemLimit: number, autoStart: boolean) {
    return this.http.post<Status>('add', {url: url, quality: quality, format: format, folder: folder, custom_name_prefix: customNamePrefix, playlist_strict_mode: playlistStrictMode, playlist_item_limit: playlistItemLimit, auto_start: autoStart}).pipe(
      catchError(this.handleHTTPError)
    );
  }

  // Optional preflight probe to get metadata (duration/size); proceed if unavailable
  public probe(url: string) {
    return this.http.get<any>('probe', { params: { url } }).pipe(
      catchError(this.handleHTTPError)
    );
  }

  public startById(ids: string[]) {
    return this.http.post('start', {ids: ids});
  }

  public delById(where: string, ids: string[]) {
    ids.forEach(id => this[where].get(id).deleting = true);
    return this.http.post('delete', {where: where, ids: ids});
  }

  public startByFilter(where: string, filter: (dl: Download) => boolean) {
    let ids: string[] = [];
    this[where].forEach((dl: Download) => { if (filter(dl)) ids.push(dl.url) });
    return this.startById(ids);
  }

  public delByFilter(where: string, filter: (dl: Download) => boolean) {
    let ids: string[] = [];
    this[where].forEach((dl: Download) => { if (filter(dl)) ids.push(dl.url) });
    return this.delById(where, ids);
  }

  public addDownloadByUrl(url: string): Promise<any> {
    const defaultQuality = 'best';
    const defaultFormat = 'mp4';
    const defaultFolder = ''; 
    const defaultCustomNamePrefix = '';
    const defaultPlaylistStrictMode = false;
    const defaultPlaylistItemLimit = 0;
    const defaultAutoStart = true;
    
    return new Promise((resolve, reject) => {
      this.add(url, defaultQuality, defaultFormat, defaultFolder, defaultCustomNamePrefix, defaultPlaylistStrictMode, defaultPlaylistItemLimit, defaultAutoStart)
        .subscribe(
          response => resolve(response),
          error => reject(error)
        );
    });
  }

  public exportQueueUrls(): string[] {
    return Array.from(this.queue.values()).map(download => download.url);
  }
}
