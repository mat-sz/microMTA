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

    constructor(private socket: Socket, 
                private options: microMTAOptions,
                private onMessage: (message: microMTAMessage) => void,
                private onError: (error: Error) => void) {

        socket.setEncoding('utf8');

        this.reply(220, this.options.hostname + ' ESMTP microMTA');

        socket.on('error', err => this.onError(err));
        socket.on('data', data => this.handleData(data));
    }

    private reply(code: number, message: string) {
        this.socket.write(code + ' ' + message + ending);
    }

    private handleData(data: Buffer) {
        const string = data.toString();
        
        if (!this.isData && string.includes(ending)) {
            const commands = string.split(ending);
            commands[0] = this.buffer + commands[0];

            for (let i = 0; i < commands.length - 1; i++) {
                const [ command, argument ] = commands[i].split(' ', 2);
                this.handleCommand(command, argument);
            }

            this.buffer = commands[commands.length - 1];
        } else {
            this.buffer += string;

            if (this.isData && this.buffer.includes(dataEnding)) {
                this.handleMessage();
            }
        }
    }

    private handleMessage() {
        if (this.sender) {
            this.onMessage({
                recipients: this.recipients,
                sender: this.sender,
                message: this.buffer.substring(0, this.buffer.length - 5),
            } as microMTAMessage);
            this.reply(250, 'Ok');
        } else {
            this.reply(503, 'Bad sequence');
        }

        this.buffer = '';
        this.isData = false;
    }

    private handleCommand(command: string, argument: string) {
        switch (command) {
            case SMTPCommand.HELO:
                this.reply(250, this.options.hostname + ', greeting accepted.');
                break;
            case SMTPCommand.MAIL:
                if (argument.startsWith('FROM:<') && argument.endsWith('>')) {
                    this.sender = argument.substring(6, argument.length - 1);
                    this.reply(250, 'Ok');
                } else {
                    this.reply(501, 'Argument syntax error');
                }
                break;
            case SMTPCommand.RCPT:
                if (argument.startsWith('TO:<') && argument.endsWith('>')) {
                    this.recipients.push(argument.substring(4, argument.length - 1));
                    this.reply(250, 'Ok');
                } else {
                    this.reply(501, 'Argument syntax error');
                }
                break;
            case SMTPCommand.DATA:
                if (this.recipients.length > 0 && this.sender) {
                    this.reply(354, 'End data with <CR><LF>.<CR><LF>');
                    this.isData = true;
                } else {
                    this.reply(503, 'Bad sequence');
                }
                break;
            case SMTPCommand.QUIT:
                this.reply(221, 'Bye');
                break;
            default:
                this.reply(502, 'Not implemented');
        }
    }
}
