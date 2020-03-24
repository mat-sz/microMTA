import { createServer, Server, Socket } from 'net';

import { microMTAEvents, microMTAErrorEventListener, microMTAMessageEventListener } from './events';
import { microMTAMessage } from './message';
import { microMTAOptions } from './options';
import { microMTAConnection } from './connection';

export class microMTA {
    private server: Server;

    private events: microMTAEvents = {
        message: new Set(),
        error: new Set(),
    };

    private options: microMTAOptions = {
        hostname: 'localhost',
    };

    constructor(options?: microMTAOptions) {
        this.options = {
            ...this.options,
            ...options,
        };

        this.server = createServer(socket => this.connection(socket));
    }

    start() {
        this.server.listen(25);
    }

    stop() {
        this.server.close();
    }

    on(eventType: 'message', listener: microMTAMessageEventListener): void;

    on(eventType: 'error', listener: microMTAErrorEventListener): void;

    on(eventType: keyof microMTAEvents, listener: Function) {
        this.events[eventType].add(listener as any);
    }

    off(eventType: 'message', listener: microMTAMessageEventListener): void;

    off(eventType: 'error', listener: microMTAErrorEventListener): void;

    off(eventType: keyof microMTAEvents, listener: Function) {
        this.events[eventType].delete(listener as any);
    }

    private emit(eventType: keyof microMTAEvents, ...args: any[]) {
        for (let listener of this.events[eventType]) {
            (listener as Function).apply(this, args);
        }
    }

    private message(recipients: string[], sender: string, message: string) {
        this.emit('message', {
            recipients,
            sender,
            message,
        } as microMTAMessage);
    }

    private error(error: Error) {
        this.emit('error', error);
    }

    private connection(socket: Socket) {
        new microMTAConnection(
            socket,
            this.options,
            this.message.bind(this),
            this.error.bind(this)
        );
    }
}
