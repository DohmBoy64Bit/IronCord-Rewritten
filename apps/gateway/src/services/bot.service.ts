import { IRCClient } from '@ironcord/engine';
import { logger } from '@ironcord/shared';
import { config } from '../config/env.js';
import { gatewayEvents } from '../events.js';

export class BotService {
    private client: IRCClient;

    constructor() {
        this.client = new IRCClient({
            host: config.ircHost,
            port: config.ircPort,
            nick: config.botNick,
            username: 'ironcord',
            realname: 'IronCord System Bot',
            password: config.botPassword,
            email: 'bot@ironcord.local',
        });

        this.setupHandlers();
    }

    public start(): void {
        logger.info('BOT-SERVICE', {
            message: 'Starting IronCord System Bot',
            nick: config.botNick,
            host: config.ircHost,
            port: config.ircPort
        });
        this.client.connect();
    }

    private setupHandlers(): void {
        this.client.on('registered', () => {
            logger.info('BOT-SERVICE', { message: 'Bot registered on IRC' });
        });

        this.client.on('error', (err: Error) => {
            logger.error('BOT-SERVICE', { error: err.message });
        });

        gatewayEvents.on('irc:provision-channel', (data: { channel: string; ownerNick: string }) => {
            this.provisionChannel(data.channel, data.ownerNick);
        });
    }

    private provisionChannel(channel: string, ownerNick: string): void {
        if (!this.client.ready()) {
            logger.warn('BOT-PROVISION', { message: 'Bot not ready, skipping provision', channel });
            return;
        }

        logger.info('BOT-PROVISION', {
            phase: 'start',
            channel,
            ownerNick
        });

        // 1. Join the channel
        this.client.join(channel);

        // 2. Wait for join to settle, then register with ChanServ
        // Ergo ChanServ command: REGISTER <#channel>
        setTimeout(() => {
            logger.info('BOT-PROVISION', { phase: 'registering', channel });
            this.client.privmsg('ChanServ', `REGISTER ${channel}`);

            // 3. Transfer/Set founder to the user who created it
            // In Ergo: ChanServ SET <#channel> FOUNDER <nick>
            setTimeout(() => {
                logger.info('BOT-PROVISION', {
                    phase: 'transferring-ownership',
                    channel,
                    newFounder: ownerNick
                });
                this.client.privmsg('ChanServ', `SET ${channel} FOUNDER ${ownerNick}`);
            }, 1000);
        }, 1000);
    }

    public stop(): void {
        this.client.disconnect();
    }
}
