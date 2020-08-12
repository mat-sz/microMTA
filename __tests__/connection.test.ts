import { microMTAConnection } from '../src/connection';

class Socket {
  lastMessage = '';
  listeners: Record<string, Function[]> = {};

  setEncoding(encoding: string) {}

  on(event: string, listener: Function) {
    if (this.listeners[event]) {
      this.listeners[event].push(listener);
    } else {
      this.listeners[event] = [listener];
    }
  }

  emit(event: string, ...args: any[]) {
    this.listeners[event].forEach(listener => listener.call(this, ...args));
  }

  write(data: string) {
    const messages = data.split('\r\n');
    if (messages[messages.length - 1] === '') {
      this.lastMessage = messages[messages.length - 2];
    } else {
      this.lastMessage = messages[messages.length - 1];
    }
  }

  destroy() {}
}

describe('connection', () => {
  it('welcomes clients', () => {
    const socket = new Socket();
    const connection = new microMTAConnection(
      socket as any,
      { hostname: 'localhost', size: 100000 },
      () => {},
      () => {},
      () => {}
    );

    expect(socket.lastMessage).toEqual('220 localhost ESMTP microMTA');
  });
});
