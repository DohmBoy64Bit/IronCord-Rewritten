import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '@ironcord/shared';
import { config } from '../../config/env.js';
import { authenticateSocket } from './middleware/auth.js';
import { ConnectionHandler } from './handlers/connection.js';
import { IRCBridgeHandler } from './handlers/irc-bridge.js';

export class WebSocketServer {
  private io: SocketIOServer;
  private connectionHandler: ConnectionHandler;
  private ircBridgeHandler: IRCBridgeHandler;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.nodeEnv === 'production' ? config.clientOrigin : '*',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.connectionHandler = new ConnectionHandler();
    this.ircBridgeHandler = new IRCBridgeHandler(this.connectionHandler);

    this.setupMiddleware();
    this.setupConnectionHandlers();

    logger.info('WS-SERVER', { message: 'WebSocket server initialized' });
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
