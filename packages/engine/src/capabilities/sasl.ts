import { EventEmitter } from 'events';
import { logger } from '@ironcord/shared';
import type { IRCMessage } from '../types.js';
import { formatAuthenticatePlain, formatAuthenticateResponse, formatCapabilityEnd, formatRegister } from '../protocol/formatter.js';

export interface SASLHandlerEvents {
  send: (data: string) => void;
  success: () => void;
  failure: (error: Error) => void;
  registered: () => void;
}

export class SASLHandler extends EventEmitter {
  private nick: string;
  private password: string | undefined;

  constructor(nick: string, password: string | undefined) {
    super();
    this.nick = nick;
    this.password = password;
  }

  public handleCapabilityAck(ackedCaps: string[]): void {
    if (ackedCaps.includes('sasl') && this.password) {
      this.emit('send', formatAuthenticatePlain());
    } else {
      this.emit('send', formatCapabilityEnd());
    }
  }

  public handleAuthenticate(message: IRCMessage): void {
    if (message.params[0] === '+') {
      if (!this.password) {
        logger.warn('SASL', { message: 'Server requested AUTHENTICATE, but no password configured' });
        this.emit('send', formatCapabilityEnd());
        return;
      }

      this.emit('send', formatAuthenticateResponse(this.nick, this.password));
    }
  }

  public handleNumeric(message: IRCMessage): void {
    switch (message.command) {
      case '903':
        this.emit('success');
        this.emit('send', formatCapabilityEnd());
        break;

      case '904':
      case '905':
        if (message.raw.includes('Account does not exist') && this.password) {
          this.emit('send', formatRegister(this.nick, this.password));
        } else {
          this.emit('failure', new Error('SASL Authentication Failed'));
        }
        break;

      case '900':
        this.emit('registered');
        this.emit('send', formatCapabilityEnd());
        break;

      case '907':
        this.emit('send', formatCapabilityEnd());
        break;
    }

    if (message.raw.includes('Account successfully registered')) {
      this.emit('registered');
      this.emit('send', formatCapabilityEnd());
    }
  }
}
