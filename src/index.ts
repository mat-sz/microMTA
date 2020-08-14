import { createServer, Server, Socket } from 'net';
import {
  createServer as createTLSServer,
  Server as TLSServer,
  createSecureContext,
} from 'tls';

import {
  microMTAEvents,
  microMTAErrorEventListener,
  microMTAMessageEventListener,
  microMTARejectedEventListener,
} from './events';
import { microMTAOptions } from './options';
import { microMTAConnection } from './connection';
import { SERVER_SHUTTING_DOWN } from './smtp/replies';

export class microMTA {
  private server: Server;
  private tlsServer: TLSServer | undefined;

  private connections: Set<microMTAConnection> = new Set();

  private events: microMTAEvents = {
    message: new Set(),
    error: new Set(),
    rejected: new Set(),
  };

  private options: microMTAOptions = {
    hostname: 'localhost',
    ip: '0.0.0.0',
    port: 25,
    tlsPort: 465,
    size: 10000000,
  };

  constructor(options?: microMTAOptions) {
    this.options = {
      ...this.options,
      ...options,
    };

    this.server = createServer(socket => this.connection(socket));
    this.server.listen(this.options.port, this.options.ip);

    if (this.options.tlsPort && this.options.secureContextOptions) {
      this.tlsServer = createTLSServer(
        {
          secureContext: createSecureContext(this.options.secureContextOptions),
        },
        socket => this.connection(socket)
      );
      this.tlsServer.listen(this.options.tlsPort, this.options.ip);
    }

    setInterval(this.pruneConnections.bind(this), 1000);
  }

  close() {
    this.connections.forEach(connection => {
      if (connection.isOpen) {
        connection.reply(...SERVER_SHUTTING_DOWN);
        connection.close();
      }
    });

    this.server.close(() => this.server.unref());
  }

  /**
   * Adds a listener for a rejected message event.
   * @param eventType Event type. (rejected)
   * @param listener Listener function.
   */
  on(eventType: 'rejected', listener: microMTARejectedEventListener): void;

  /**
   * Adds a listener for a message event.
   * @param eventType Event type. (message)
   * @param listener Listener function.
   */
  on(eventType: 'message', listener: microMTAMessageEventListener): void;

  /**
   * Adds a listener for an error event.
   * @param eventType Event type. (error)
   * @param listener Listener function.
   */
  on(eventType: 'error', listener: microMTAErrorEventListener): void;

  /**
   * Adds a listener for a given event.
   * @param eventType Event type.
   * @param listener Listener function.
   */
  on(eventType: keyof microMTAEvents, listener: Function) {
    this.events[eventType].add(listener as any);
  }

  /**
   * Removes a listener for a message event.
   * @param eventType Event type. (message)
   * @param listener Listener function.
   */
  off(eventType: 'rejected', listener: microMTARejectedEventListener): void;

  /**
   * Removes a listener for a message event.
   * @param eventType Event type. (message)
   * @param listener Listener function.
   */
  off(eventType: 'message', listener: microMTAMessageEventListener): void;

  /**
   * Removes a listener for an error event.
   * @param eventType Event type. (error)
   * @param listener Listener function.
   */
  off(eventType: 'error', listener: microMTAErrorEventListener): void;

  /**
   * Removes a listener for a given event.
   * @param eventType Event type.
   * @param listener Listener function.
   */
  off(eventType: keyof microMTAEvents, listener: Function) {
    this.events[eventType].delete(listener as any);
  }

  private emit(eventType: keyof microMTAEvents, ...args: any[]) {
    for (let listener of this.events[eventType]) {
      (listener as Function).apply(this, args);
    }
  }

  private connection(socket: Socket) {
    this.connections.add(
      new microMTAConnection(
        socket,
        this.options,
        message => this.emit('message', message),
        error => this.emit('error', error),
        (sender, recipients) => this.emit('rejected', sender, recipients)
      )
    );
  }

  private pruneConnections() {
    this.connections.forEach(connection => {
      if (!connection.isOpen) {
        this.connections.delete(connection);
      }
    });
  }
}
