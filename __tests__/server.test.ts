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
});
