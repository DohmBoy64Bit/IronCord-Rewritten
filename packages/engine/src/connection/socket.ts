import * as net from 'net';
import { EventEmitter } from 'events';
import { parseIRCMessage } from '../protocol/parser.js';
import type { IRCMessage } from '../types.js';

export interface SocketWrapperEvents {
  connected: () => void;
  message: (message: IRCMessage) => void;
  error: (error: Error) => void;
  close: (hadError: boolean) => void;
}

export class SocketWrapper extends EventEmitter {
  private socket: net.Socket | null = null;
  private buffer: string = '';
  private host: string;
  private port: number;

  constructor(host: string, port: number) {
    super();
    this.host = host;
    this.port = port;
  }

  public connect(): void {
    this.socket = new net.Socket();

    this.socket.on('data', (data) => {
      this.buffer += data.toString();
      const lines = this.buffer.split(/\r?\n/);
      this.buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          const message = parseIRCMessage(line);
          this.emit('message', message);
        }
      }
    });

    this.socket.on('connect', () => {
      this.emit('connected');
    });

    this.socket.on('error', (err) => {
      this.emit('error', err);
    });

    this.socket.on('close', (hadError) => {
      this.emit('close', hadError);
    });

    this.socket.connect(this.port, this.host);
  }

  public send(data: string): void {
    if (this.socket && this.socket.writable) {
      this.socket.write(data + '\r\n');
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.writable;
  }
}
