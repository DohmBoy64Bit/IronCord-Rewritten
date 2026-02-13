import { EventEmitter } from 'events';

class GatewayEvents extends EventEmitter { }

export const gatewayEvents = new GatewayEvents();
