import { microMTA } from '../src';
import { Socket } from 'net';

let currentPort = 2525;
const nextPort = () => {
  currentPort++;
  return currentPort;
};

describe('server', () => {
  it('starts listening without exceptions', () => {
    const port = nextPort();
    const mta = new microMTA({
      hostname: 'localhost',
      ip: '127.0.0.1',
      port,
    });
    mta.close();
  });

  it('closes client socket on .close', done => {
    const port = nextPort();
    const mta = new microMTA({
      hostname: 'localhost',
      ip: '127.0.0.1',
      port,
    });

    const socket = new Socket();
    const onData = jest.fn();
    socket.on('connect', () => {
      socket.write('EHLO\r\n');
    });
    socket.on('data', data => {
      onData(data.toString());
      mta.close();
    });
    socket.on('close', () => {
      expect(onData).toHaveBeenCalledWith(
        '421 The server is shutting down\r\n'
      );
      done();
    });
    socket.connect({ host: '127.0.0.1', port });
  });

  it('handles incoming mail', done => {
    const port = nextPort();
    const mta = new microMTA({
      hostname: 'localhost',
      ip: '127.0.0.1',
      port,
    });
    const onMessage = jest.fn();
    mta.on('message', onMessage);

    const socket = new Socket();
    socket.on('connect', () => {
      socket.write(
        'EHLO\r\nMAIL FROM:<a@localhost>\r\nRCPT TO:<b@localhost>\r\nDATA\r\n'
      );
    });

    let messageSent = false;
    socket.on('data', buffer => {
      const string = buffer.toString();
      if (string.includes('354')) {
        socket.write('Test\r\n.\r\n');
        messageSent = true;
      } else if (messageSent && string.includes('250')) {
        socket.write('QUIT\r\n');
      }
    });

    socket.on('close', () => {
      mta.close();
      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          recipients: ['b@localhost'],
          sender: 'a@localhost',
          message: 'Test',
        })
      );
      done();
    });
    socket.connect({ host: '127.0.0.1', port });
  });

  it('handles incoming mail (case insensitive)', done => {
    const port = nextPort();
    const mta = new microMTA({
      hostname: 'localhost',
      ip: '127.0.0.1',
      port,
    });
    const onMessage = jest.fn();
    mta.on('message', onMessage);

    const socket = new Socket();
    socket.on('connect', () => {
      socket.write(
        'EHLO\r\nMAIL From:<a@localhost>\r\nRCPT tO:<b@localhost>\r\nDATA\r\n'
      );
    });

    let messageSent = false;
    socket.on('data', buffer => {
      const string = buffer.toString();
      if (string.includes('354')) {
        socket.write('Test\r\n.\r\n');
        messageSent = true;
      } else if (messageSent && string.includes('250')) {
        socket.write('QUIT\r\n');
      }
    });

    socket.on('close', () => {
      mta.close();
      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          recipients: ['b@localhost'],
          sender: 'a@localhost',
          message: 'Test',
        })
      );
      done();
    });
    socket.connect({ host: '127.0.0.1', port });
  });
});
