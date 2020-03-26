import { Socket } from 'net';

import { microMTAMessage } from './message';
import { microMTAOptions } from './options';
import { SMTPCommand } from './commands';

const ending = '\r\n';
const dataEnding = '\r\n.\r\n';

export class microMTAConnection {
  private buffer = '';
  private isData = false;
  private recipients: string[] = [];
  private sender?: string;

  constructor(
    private socket: Socket,
    private options: microMTAOptions,
    private onMessage: (message: microMTAMessage) => void,
    private onError: (error: Error) => void
  ) {
    this.socket.setEncoding('ascii');

    // Welcome message.
    this.reply(220, this.options.hostname + ' ESMTP microMTA');

    socket.on('error', err => this.onError(err));
    socket.on('data', data => this.handleData(data));
  }

  private reply(code: number, message: string) {
    if (message.includes('\n')) {
      const lines = message.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (i === lines.length - 1) {
          this.socket.write(code + ' ' + lines[i] + ending);
        } else {
          this.socket.write(code + '-' + lines[i] + ending);
        }
      }
    } else {
      this.socket.write(code + ' ' + message + ending);
    }
  }

  private handleData(data: Buffer) {
    const string = data.toString();

    if (!this.isData && string.includes(ending)) {
      const commands = string.split(ending);
      commands[0] = this.buffer + commands[0];

      // Execute any commands we find in the buffer.
      // Sometimes the text data may be divided
      // between multiple data events.
      for (let i = 0; i < commands.length - 1; i++) {
        const [command, argument] = commands[i].split(' ', 2);
        this.handleCommand(command.toUpperCase(), argument);
      }

      // Store the incomplete command (or '') as the new buffer.
      this.buffer = commands[commands.length - 1];
    } else {
      this.buffer += string;

      // If a DATA message was sent, store all the
      // incoming contents awaiting an ending.
      if (this.isData && this.buffer.includes(dataEnding)) {
        this.handleMessage();
      }
    }
  }

  private handleMessage() {
    if (this.sender) {
      let message = this.buffer;

      // Remove last 5 characters (ending indicator).
      message = message.substring(0, this.buffer.length - 5);

      // Undo dot stuffing.
      message = message
        .split('\r\n')
        .map(line => (line.startsWith('..') ? line.substring(1) : line))
        .join('\r\n');

      this.onMessage({
        recipients: this.recipients,
        sender: this.sender,
        message,
      } as microMTAMessage);
      this.reply(250, 'Ok');
    } else {
      this.reply(503, 'Bad sequence');
    }

    this.buffer = '';
    this.isData = false;
  }

  private handleCommand(command: string, argument: string) {
    const args = argument ? argument.replace(': ', '').split(' ') : [];

    switch (command) {
      case SMTPCommand.HELO:
        // HELO hostname
        this.reply(250, this.options.hostname + ', greeting accepted.');
        break;
      case SMTPCommand.EHLO:
        // EHLO hostname
        this.socket.setEncoding('utf8');
        this.reply(
          250,
          this.options.hostname +
            ', greeting accepted.\nSMTPUTF8\nPIPELINING\nSIZE 10000000'
        );
        break;
      case SMTPCommand.MAIL:
        // MAIL FROM:<user@example.com>
        if (
          args.length > 0 &&
          args[0].startsWith('FROM:<') &&
          args[0].endsWith('>')
        ) {
          this.sender = argument.substring(6, argument.length - 1);
          this.reply(250, 'Ok');
        } else {
          this.reply(501, 'Argument syntax error');
        }
        break;
      case SMTPCommand.RCPT:
        // RCPT TO:<user@example.com>
        if (
          args.length > 0 &&
          args[0].startsWith('TO:<') &&
          args[0].endsWith('>')
        ) {
          this.recipients.push(argument.substring(4, argument.length - 1));
          this.reply(250, 'Ok');
        } else {
          this.reply(501, 'Argument syntax error');
        }
        break;
      case SMTPCommand.DATA:
        // DATA
        if (this.recipients.length > 0 && this.sender) {
          this.reply(354, 'End data with <CR><LF>.<CR><LF>');
          this.isData = true;
        } else {
          this.reply(503, 'Bad sequence');
        }
        break;
      case SMTPCommand.RSET:
        this.recipients = [];
        this.sender = undefined;
        this.reply(250, 'Ok');
        break;
      case SMTPCommand.NOOP:
        this.reply(250, 'Ok');
        break;
      case SMTPCommand.QUIT:
        // QUIT
        this.reply(221, 'Bye');
        this.socket.destroy();
        break;
      default:
        this.reply(502, 'Not implemented');
    }
  }
}
