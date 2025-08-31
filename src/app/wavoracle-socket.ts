import { Injectable } from '@angular/core';
import io, { Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WavOracleSocket {
  private socket: Socket;
  private isConnected = false;
  private eventBuffer: { event: string; data: any }[] = [];
  private readonly maxBufferSize = 50;

  constructor() {
    try {
      const base = (location.hostname === 'localhost' && location.port === '4200')
        ? 'http://localhost:8081'
        : 'https://api.wavoracle.com';
      const path = '/socket.io';    // let Angular proxy forward to 8081
      this.socket = io(base, { 
        path,
        transports: ['websocket', 'polling'],
        timeout: 8000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });
      
      // Handle connection events
      this.socket.on('connect', () => {
        console.log('Socket connected');
        this.isConnected = true;
        // Flush buffer on connect
        this.flushBuffer();
      });
      
      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
        this.isConnected = false;
      });
      
      this.socket.on('connect_error', (error) => {
        console.warn('Socket connection error:', error);
        this.isConnected = false;
      });

      this.socket.on('reconnect', () => {
        console.log('Socket reconnected');
        this.isConnected = true;
        this.flushBuffer();
      });
      
    } catch (error) {
      console.error('Failed to initialize socket:', error);
      this.isConnected = false;
    }
  }

  // Add the fromEvent method that your downloads service needs
  fromEvent(event: string) {
    return new Observable((observer) => {
      const handler = (data: any) => observer.next(data);
      this.socket?.on(event, handler);

      // Deliver buffered events for this event type
      this.eventBuffer
        .filter(e => e.event === event)
        .forEach(e => observer.next(e.data));

      return () => this.socket?.off(event, handler);
    });
  }

  // Other socket methods
  connect() {
    if (this.socket) {
      this.socket.connect();
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  emit(event: string, data: any) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    }
    // Buffer outgoing as a fallback for UI catch-up (optional semantics)
    this.bufferEvent(event, data);
  }

  on(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(event, (data: any) => {
        this.bufferEvent(event, data);
        callback(data);
      });
    }
  }

  getSocket(): Socket {
    return this.socket;
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }

  private bufferEvent(event: string, data: any) {
    this.eventBuffer.push({ event, data });
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer.splice(0, this.eventBuffer.length - this.maxBufferSize);
    }
  }

  private flushBuffer() {
    // No-op: buffer is delivered to subscribers on subscription
  }
}
