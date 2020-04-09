import { microMTAConnection } from '../src/connection';

class Socket {
  lastMessage = '';

  setEncoding(encoding: string) {}

  on(event: string, listener: Function) {}

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
