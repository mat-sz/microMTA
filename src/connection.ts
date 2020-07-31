import { Socket } from 'net';

import { microMTAMessage } from './message';
import { microMTAOptions } from './options';
import { SMTPCommand } from './commands';

const ending = '\r\n';
const dataEnding = '\r\n.\r\n';
const defaultSize = 1000000;

export class microMTAConnection {
  private buffer = '';
  private open = false;
  private greeted = false;
  private isAcceptingData = false;
  private recipients: string[] = [];
  private sender?: string;

  constructor(
    private socket: Socket,
    private options: microMTAOptions,
    private onMessage: (message: microMTAMessage) => void,
    private onError: (error: Error) => void,
    private onRejected: (sender: string, recipients: string[]) => void
  ) {
    this.socket.setEncoding('utf8');
    this.open = true;

    // Welcome message.
    this.reply(220, this.options.hostname + ' ESMTP microMTA');

    socket.on('error', err => this.onError(err));
    socket.on('data', data => this.handleData(data));
    socket.on('close', () => (this.open = false));
    socket.on('end', () => (this.open = false));
  }

  get isOpen() {
    return this.open;
  }

  close() {
    this.socket.destroy();
    this.open = false;
  }

  reply(code: number, message: string) {
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

    if (!this.isAcceptingData && string.includes(ending)) {
      const commands = string.split(ending);
      commands[0] = this.buffer + commands[0];

      // Execute any commands we find in the buffer.
      // Sometimes the text data may be divided
      // between multiple data events.
      for (let i = 0; i < commands.length - 1; i++) {
        const args = commands[i].split(' ');
        const command = args.splice(0, 1)[0];
        this.handleCommand(command.toUpperCase(), args);
      }

      // Store the incomplete command (or '') as the new buffer.
      this.buffer = commands[commands.length - 1];
    } else {
      this.buffer += string;

      if (this.isAcceptingData) {
        if (this.buffer.length > (this.options.size ?? defaultSize)) {
          this.buffer = '';
          this.reply(552, 'Maximum size exceeded');
        }

        // If a DATA message was sent, store all the
        // incoming contents awaiting an ending.
        if (this.buffer.includes(dataEnding)) {
          this.handleMessage();
        }
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
    this.isAcceptingData = false;
  }

  private handleCommand(command: string, args: string[]) {
    if (!this.greeted) {
      switch (command) {
        case SMTPCommand.HELO:
          // HELO hostname
          this.reply(250, this.options.hostname + ', greeting accepted.');

          this.greeted = true;
          break;
        case SMTPCommand.EHLO:
          // EHLO hostname
          this.reply(
            250,
            this.options.hostname +
              ', greeting accepted.\nSMTPUTF8\nPIPELINING\n8BITMIME\nSIZE ' +
              (this.options.size ?? defaultSize)
          );

          this.greeted = true;
          break;
        default:
          this.reply(503, 'Bad sequence');
      }

      return;
    }

    switch (command) {
      case SMTPCommand.HELO:
      case SMTPCommand.EHLO:
        this.reply(503, 'Bad sequence');
        break;
      case SMTPCommand.MAIL:
        // MAIL FROM:<user@example.com>
        if (
          args.length > 0 &&
          args[0].startsWith('FROM:<') &&
          args[0].endsWith('>')
        ) {
          let size = 0;
          if (args.length > 1) {
            for (let arg of args) {
              if (arg.toUpperCase().startsWith('SIZE=')) {
                size = parseInt(arg.substring(5));
              }
            }
          }

          const sender = args[0].substring(6, args[0].length - 1);
          if (size && size > (this.options.size ?? defaultSize)) {
            this.reply(552, 'Maximum size exceeded');
            this.onRejected(sender, this.recipients);
            break;
          }

          this.sender = sender;
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
          this.recipients.push(args[0].substring(4, args[0].length - 1));
          this.reply(250, 'Ok');
        } else {
          this.reply(501, 'Argument syntax error');
        }
        break;
      case SMTPCommand.DATA:
        // DATA
        if (this.recipients.length > 0 && this.sender) {
          this.reply(354, 'End data with <CR><LF>.<CR><LF>');
          this.isAcceptingData = true;
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
        this.open = false;
        break;
      default:
        this.reply(502, 'Not implemented');
    }
  }
}
