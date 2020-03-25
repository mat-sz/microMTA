import { createServer, Server, Socket } from 'net';

import {
  microMTAEvents,
  microMTAErrorEventListener,
  microMTAMessageEventListener,
} from './events';
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

  /**
   * Starts the server at port 25. Requires elevated privileges on most systems.
   */
  start() {
    this.server.listen(25);
  }

  /**
   * Stops the server.
   */
  stop() {
    this.server.close();
  }

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
    new microMTAConnection(
      socket,
      this.options,
      message => this.emit('message', message),
      error => this.emit('error', error)
    );
  }
}
