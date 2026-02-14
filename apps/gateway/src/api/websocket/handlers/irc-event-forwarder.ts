import { Socket } from 'socket.io';
import { IRCClient } from '@ironcord/engine';
import type { IRCMessageData, IRCMembers, IRCPresence, ReconnectEvent, IRCTyping, IRCReaction } from '@ironcord/engine';
import type { UserPresence } from '@ironcord/shared/types';
import { logger } from '@ironcord/shared';

export class IRCEventForwarder {
    public static setup(socket: Socket, ircClient: IRCClient, autojoinFn: () => void): void {
        ircClient.on('registered', () => {
            logger.info('WS-IRC-EVENT', {
                socketId: socket.id,
                event: 'registered',
            });
            socket.emit('irc:registered');
            autojoinFn();
        });

        ircClient.on('message', (data: IRCMessageData) => {
            logger.debug('WS-IRC-EVENT', {
                socketId: socket.id,
                event: 'message',
                channel: data.channel,
                author: data.author,
            });
            socket.emit('irc:message', data);
        });

        ircClient.on('history', (messages: IRCMessageData[]) => {
            logger.info('WS-IRC-EVENT', {
                socketId: socket.id,
                event: 'history',
                count: messages.length,
            });
            socket.emit('irc:history', messages);
        });

        ircClient.on('members', (data: IRCMembers) => {
            logger.debug('WS-IRC-EVENT', {
                socketId: socket.id,
                event: 'members',
                channel: data.channel,
                count: data.members.length,
            });
            socket.emit('irc:members', data);
        });

        ircClient.on('presence', (data: IRCPresence) => {
            let status: UserPresence = data.status as any;
            if (data.status === 'away') {
                const msg = (data.message || '').replace(/^:/, '').trim().toLowerCase();
                if (msg.includes('idle')) {
                    status = 'idle';
                } else if (msg.includes('do not disturb') || msg.includes('dnd')) {
                    status = 'dnd';
                } else if (msg.includes('invisible')) {
                    status = 'invisible';
                } else {
                    status = 'idle';
                }
            }

            socket.emit('irc:presence', { ...data, status });
        });

        ircClient.on('typing', (data: IRCTyping) => {
            socket.emit('irc:typing', data);
        });

        ircClient.on('reaction', (data: IRCReaction) => {
            socket.emit('irc:reaction', data);
        });

        ircClient.on('error', (error: Error) => {
            logger.error('WS-IRC-EVENT', {
                socketId: socket.id,
                event: 'error',
                error: error.message,
            });
            socket.emit('irc:error', { error: error.message });
        });

        ircClient.on('close', () => {
            socket.emit('irc:close');
        });

        ircClient.on('reconnecting', (event: ReconnectEvent) => {
            socket.emit('irc:reconnecting', event);
        });

        ircClient.on('reconnect_failed', () => {
            socket.emit('irc:reconnect_failed');
        });
    }
}
