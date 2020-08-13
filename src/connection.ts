import { Socket } from 'net';
import { TLSSocket, createSecureContext } from 'tls';
import { toByteArray } from 'base64-js';
import { TextDecoder } from 'util';

import { microMTAMessage } from './message';
import { microMTAOptions } from './options';
import { SMTPCommand } from './smtp/commands';
import * as SMTPReply from './smtp/replies';

const ending = '\r\n';
const dataEnding = '\r\n.\r\n';
const defaultSize = 1000000;

const authLoginUsername = 'VXNlcm5hbWU6';
const authLoginPassword = 'UGFzc3dvcmQ6';

const textDecoder = new TextDecoder('utf-8');
const base64Decode = (input: string): string => {
  if (!input) {
    return '';
  }

  try {
    return textDecoder.decode(toByteArray(input));
  } catch {
    return '';
  }
};

export class microMTAConnection {
  private buffer = '';
  private secure = false;
  private open = false;
  private greeted = false;
  private isAcceptingData = false;
  private recipients: string[] = [];
  private sender?: string;
  private isAuthenticating?: string;
  private authenticationUsername?: string;
  private authenticationPassword?: string;
  private authorizationIdentity?: string;

  /**
   * Connection state, can be used to store authentication data.
   */
  public state: any;

  public isAuthenticated = false;

  constructor(
    private socket: Socket,
    private options: microMTAOptions,
    private onMessage: (message: microMTAMessage) => void,
    private onError: (error: Error) => void,
    private onRejected: (sender: string, recipients: string[]) => void
  ) {
    this.socket.setEncoding('utf8');
    this.open = true;

    if (this.socket instanceof TLSSocket) {
      this.secure = this.socket.encrypted;
    }

    // Welcome message.
    this.reply(220, this.options.hostname + ' ESMTP microMTA');
    this.addListeners(socket);
  }

  get isOpen() {
    return this.open;
  }

  private get supportedAuthenticationMethods() {
    if (!this.options.authenticate) {
      return [];
    }

    return ['PLAIN', 'LOGIN'];
  }

  private get extensions() {
    const extensions = ['SMTPUTF8', 'PIPELINING', '8BITMIME'];

    if (!this.secure && this.options.secureContextOptions) {
      extensions.push('STARTTLS');
    }

    if (this.options.authenticate) {
      extensions.push('AUTH ' + this.supportedAuthenticationMethods.join(' '));
    }

    extensions.push('SIZE ' + (this.options.size ?? defaultSize));

    return extensions;
  }

  close() {
    this.socket.destroy();
    this.open = false;
  }

  reply(code: number, message?: string) {
    if (!message) {
      this.socket.write(code + ending);
      return;
    }

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

    // 5xx errors result in an ended connection.
    if (code >= 500) {
      this.close();
    }
  }

  private get greeting() {
    return this.options.hostname + ', greeting accepted.';
  }

  private get extendedGreeting() {
    return this.greeting + '\n' + this.extensions.join('\n');
  }

  private addListeners(socket: Socket) {
    socket.on('error', err => this.onError(err));
    socket.on('data', data => this.handleData(data));
    socket.on('close', () => (this.open = false));
    socket.on('end', () => (this.open = false));
  }

  private starttls() {
    if (!this.options.secureContextOptions || this.secure) {
      return;
    }

    this.greeted = false;

    this.socket.removeAllListeners('error');
    this.socket.removeAllListeners('data');
    this.socket.removeAllListeners('close');
    this.socket.removeAllListeners('end');

    const secureContext = createSecureContext(
      this.options.secureContextOptions
    );

    const tlsSocket = new TLSSocket(this.socket, {
      secureContext,
      rejectUnauthorized: false,
      isServer: true,
    });
    tlsSocket.setEncoding('utf8');
    this.socket = tlsSocket;

    // secure event needs to be used here instead of secureConnect.
    tlsSocket.on('secure', () => {
      this.secure = true;
      this.addListeners(tlsSocket);
    });
  }

  private async handleData(data: Buffer) {
    const string = data.toString();

    if (!this.isAcceptingData && string.includes(ending)) {
      const commands = string.split(ending);
      commands[0] = this.buffer + commands[0];

      // Execute any commands we find in the buffer.
      // Sometimes the text data may be divided
      // between multiple data events.
      for (let i = 0; i < commands.length - 1; i++) {
        if (this.isAuthenticating) {
          await this.handleAuthentication(commands[i].split(' '));
        } else {
          const args = commands[i].split(' ');
          const command = args.splice(0, 1)[0];
          this.handleCommand(command.toUpperCase(), args);
        }
      }

      // Store the incomplete command (or '') as the new buffer.
      this.buffer = commands[commands.length - 1];
    } else {
      this.buffer += string;

      if (this.isAcceptingData) {
        if (this.buffer.length > (this.options.size ?? defaultSize)) {
          this.buffer = '';
          this.reply(...SMTPReply.MAXIMUM_SIZE_EXCEEDED);
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
      this.reply(...SMTPReply.OK);
    } else {
      this.reply(...SMTPReply.BAD_SEQUENCE);
    }

    this.buffer = '';
    this.isAcceptingData = false;
  }

  private async handleAuthentication(args: string[], isInitialCommand = false) {
    if (!this.isAuthenticating) {
      this.reply(...SMTPReply.BAD_SEQUENCE);
      return;
    }

    if (!this.options.authenticate) {
      return;
    }

    let isComplete = false;
    switch (this.isAuthenticating) {
      case 'PLAIN':
        if (typeof args[0] === 'string') {
          const data = base64Decode(args[0]).split('\0');
          if (data.length === 3) {
            this.authorizationIdentity = data[0];
            data.shift();
          }

          this.authenticationUsername = data[0];
          this.authenticationPassword = data[1];
          isComplete = true;
        } else if (!isInitialCommand) {
          isComplete = true;
        } else {
          this.reply(334);
        }
        break;
      case 'LOGIN':
        if (isInitialCommand) {
          this.reply(334, authLoginUsername);
        } else if (!this.authenticationUsername) {
          this.authenticationUsername = base64Decode(args[0]);
          this.reply(334, authLoginPassword);
        } else {
          this.authenticationPassword = base64Decode(args[0]);
          isComplete = true;
        }
        break;
    }

    if (
      isComplete &&
      this.authenticationPassword &&
      this.authenticationUsername
    ) {
      const result = await this.options.authenticate(
        this,
        this.authenticationUsername,
        this.authenticationPassword,
        this.authorizationIdentity
      );

      this.isAuthenticating = undefined;
      this.isAuthenticated = result;
      if (result) {
        this.reply(...SMTPReply.AUTHENTICATION_SUCCESSFUL);
      } else {
        this.reply(...SMTPReply.BAD_USERNAME_OR_PASSWORD);
      }
    }
  }

  private handleCommand(command: string, args: string[]) {
    if (!this.greeted) {
      switch (command) {
        case SMTPCommand.HELO:
          // HELO hostname
          this.reply(250, this.greeting);

          this.greeted = true;
          break;
        case SMTPCommand.EHLO:
          // EHLO hostname
          this.reply(250, this.extendedGreeting);
          this.greeted = true;
          break;
        default:
          this.reply(...SMTPReply.BAD_SEQUENCE);
      }

      return;
    }

    switch (command) {
      case SMTPCommand.HELO:
      case SMTPCommand.EHLO:
        this.reply(...SMTPReply.BAD_SEQUENCE);
        break;
      case SMTPCommand.STARTTLS:
        if (!this.options.secureContextOptions) {
          this.reply(...SMTPReply.NOT_IMPLEMENTED);
          break;
        }

        if (this.secure) {
          this.reply(...SMTPReply.BAD_SEQUENCE);
          break;
        }

        this.reply(...SMTPReply.TLS_GO_AHEAD);
        this.starttls();
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
            this.reply(...SMTPReply.MAXIMUM_SIZE_EXCEEDED);
            this.onRejected(sender, this.recipients);
            break;
          }

          this.sender = sender;
          this.reply(...SMTPReply.OK);
        } else {
          this.reply(...SMTPReply.SYNTAX_ERROR_ARGUMENT);
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
          this.reply(...SMTPReply.OK);
        } else {
          this.reply(...SMTPReply.SYNTAX_ERROR_ARGUMENT);
        }
        break;
      case SMTPCommand.DATA:
        // DATA
        if (this.recipients.length > 0 && this.sender) {
          this.reply(...SMTPReply.START_MAIL_INPUT);
          this.isAcceptingData = true;
        } else {
          this.reply(...SMTPReply.BAD_SEQUENCE);
        }
        break;
      case SMTPCommand.AUTH:
        if (!this.supportedAuthenticationMethods.includes(args[0])) {
          this.reply(...SMTPReply.NOT_IMPLEMENTED_ARGUMENT);
          break;
        }

        this.isAuthenticating = args[0];
        this.handleAuthentication(args.slice(1), true);
        break;
      case SMTPCommand.RSET:
        this.recipients = [];
        this.sender = undefined;
        this.reply(...SMTPReply.OK);
        break;
      case SMTPCommand.NOOP:
        this.reply(...SMTPReply.OK);
        break;
      case SMTPCommand.QUIT:
        // QUIT
        this.reply(...SMTPReply.BYE);
        this.socket.destroy();
        this.open = false;
        break;
      default:
        this.reply(...SMTPReply.NOT_IMPLEMENTED);
    }
  }
}
