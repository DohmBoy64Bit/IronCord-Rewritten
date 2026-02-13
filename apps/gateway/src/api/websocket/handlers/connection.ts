import { Socket } from 'socket.io';
import { IRCClient } from '@ironcord/engine';
import { logger } from '@ironcord/shared';
import type { SocketData } from '../middleware/auth.js';

export class ConnectionHandler {
  private ircClients: Map<string, IRCClient> = new Map();

  public handleConnection(socket: Socket): void {
    const socketData = socket.data as SocketData;
    
    logger.info('WS-CONNECT', {
      socketId: socket.id,
      userId: socketData.userId,
      email: socketData.email,
      message: 'Client connected',
    });

    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  public handleDisconnection(socket: Socket): void {
    const socketData = socket.data as SocketData;
    
    logger.info('WS-DISCONNECT', {
      socketId: socket.id,
      userId: socketData.userId,
      message: 'Client disconnected',
    });

    const ircClient = this.ircClients.get(socket.id);
    if (ircClient) {
      ircClient.disconnect();
      this.ircClients.delete(socket.id);
      logger.info('WS-IRC-CLEANUP', {
        socketId: socket.id,
        userId: socketData.userId,
        message: 'IRC client disconnected and cleaned up',
      });
    }
  }

  public getIRCClient(socketId: string): IRCClient | undefined {
    return this.ircClients.get(socketId);
  }

  public setIRCClient(socketId: string, client: IRCClient): void {
    this.ircClients.set(socketId, client);
  }

  public removeIRCClient(socketId: string): void {
    const client = this.ircClients.get(socketId);
    if (client) {
      client.disconnect();
      this.ircClients.delete(socketId);
    }
  }

  public getActiveClientCount(): number {
    return this.ircClients.size;
  }
}
