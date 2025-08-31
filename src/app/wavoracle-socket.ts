import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable()
export class WavOracleSocket {
  private socket: Socket;

  constructor() {
    const path = document.location.pathname.replace(/share-target/, '') + 'socket.io';
    this.socket = io('', { path });
  }

  // Add the fromEvent method that your downloads service needs
  fromEvent(event: string) {
    return new Observable((observer) => {
      this.socket.on(event, (data) => {
        observer.next(data);
      });
      
      // Return cleanup function
      return () => {
        this.socket.off(event);
      };
    });
  }

  // Other socket methods
  connect() {
    this.socket.connect();
  }

  disconnect() {
    this.socket.disconnect();
  }

  emit(event: string, data: any) {
    this.socket.emit(event, data);
  }

  on(event: string, callback: (data: any) => void) {
    this.socket.on(event, callback);
  }

  getSocket(): Socket {
    return this.socket;
  }
}
