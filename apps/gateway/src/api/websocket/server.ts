import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '@ironcord/shared';
import { config } from '../../config/env.js';
import { authenticateSocket } from './middleware/auth.js';
import { ConnectionHandler } from './handlers/connection.js';
import { IRCBridgeHandler } from './handlers/irc-bridge.js';
import type { DatabaseService } from '@ironcord/db';
import { gatewayEvents } from '../../events.js';

export class WebSocketServer {
  private io: SocketIOServer;
  private connectionHandler: ConnectionHandler;
  private ircBridgeHandler: IRCBridgeHandler;

  constructor(httpServer: HTTPServer, db: DatabaseService) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.nodeEnv === 'production' ? config.clientOrigin : '*',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.connectionHandler = new ConnectionHandler();
    this.ircBridgeHandler = new IRCBridgeHandler(this.connectionHandler, db);

    this.setupMiddleware();
    this.setupConnectionHandlers();
    this.setupInternalEventListeners();

    logger.info('WS-SERVER', { message: 'WebSocket server initialized' });
  }

  private setupInternalEventListeners(): void {
    gatewayEvents.on('irc:immediate-join', (payload: { userId: string; channel: string }) => {
      logger.info('WS-INTERNAL', { event: 'irc:immediate-join', ...payload });

      const sockets = Array.from(this.io.sockets.sockets.values());
      for (const socket of sockets) {
        if (socket.data?.userId === payload.userId) {
          const client = this.connectionHandler.getIRCClient(socket.id);
          if (client && client.ready()) {
            logger.info('WS-INTERNAL', {
              action: 'joining_channel',
              socketId: socket.id,
              channel: payload.channel
            });
            client.join(payload.channel);

            // Fetch history after join
            setTimeout(() => {
              if (client.ready()) {
                client.fetchHistory(payload.channel, 50);
              }
            }, 500);
          }
        }
      }
    });
  }

  private setupMiddleware(): void {
    this.io.use(authenticateSocket);
  }

  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket) => {
      this.connectionHandler.handleConnection(socket);
      this.ircBridgeHandler.setupHandlers(socket);
    });
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public getConnectionHandler(): ConnectionHandler {
    return this.connectionHandler;
  }

  public async close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        logger.info('WS-SERVER', { message: 'WebSocket server closed' });
        resolve();
      });
    });
  }
}
