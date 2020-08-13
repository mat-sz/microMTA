import { microMTAConnection } from '../src/connection';

class Socket {
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

  write(data: string) {}

  command(data: string) {
    this.emit('data', Buffer.from(data + '\r\n'));
  }

  destroy() {}
}

describe('connection', () => {
  it('welcomes clients', () => {
    const socket = new Socket();
    const write = jest.spyOn(socket, 'write');
    new microMTAConnection(
      socket as any,
      { hostname: 'localhost', size: 100000 },
      () => {},
      () => {},
      () => {}
    );

    expect(write).toHaveBeenCalledWith('220 localhost ESMTP microMTA\r\n');
  });

  it('connection is dropped on error', () => {
    const socket = new Socket();
    const destroy = jest.spyOn(socket, 'destroy');
    const connection = new microMTAConnection(
      socket as any,
      { hostname: 'localhost', size: 100000 },
      () => {},
      () => {},
      () => {}
    );

    socket.command('FROM');

    expect(destroy).toHaveBeenCalled();
    expect(connection.isOpen).toEqual(false);
  });

  it('handles command: HELO', () => {
    const socket = new Socket();
    const write = jest.spyOn(socket, 'write');
    new microMTAConnection(
      socket as any,
      { hostname: 'localhost', size: 100000 },
      () => {},
      () => {},
      () => {}
    );

    socket.command('HELO');

    expect(write).toHaveBeenCalledWith('250 localhost, greeting accepted.\r\n');
  });
});
