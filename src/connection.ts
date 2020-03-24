import { Socket } from 'net';

import { microMTAOptions } from './options';
import { SMTPCommand } from './commands';

const ending = '\r\n';
const dataEnding = '\r\n.\r\n';

export class microMTAConnection {
    private buffer = '';
    private receiveData = false;
    private recipients: string[] = [];
    private sender?: string;

    constructor(private socket: Socket, 
                private options: microMTAOptions,
                private onMessage: (recipients: string[], sender: string, message: string) => void,
                private onError: (error: Error) => void) {

        socket.setEncoding('utf8');

        this.reply(220, this.options.hostname + ' ESMTP microMTA');

        socket.on('error', err => this.onError(err));

        socket.on('data', data => {
            const string = data.toString();
            
            if (!this.receiveData && string.includes(ending)) {
                const commands = string.split(ending);
                commands[0] = this.buffer + commands[0];
                this.buffer = '';

                for (let i = 0; i < commands.length - 1; i++) {
                    const [ command, argument ] = commands[i].split(' ', 2);
                    this.command(command, argument);
                }

                if (!string.endsWith(ending)) {
                    this.buffer = commands[commands.length - 1];
                }
            } else {
                const messageData = this.buffer + string;
                if (this.receiveData && messageData.includes(dataEnding)) {
                    if (this.sender) {
                        this.onMessage(this.recipients, this.sender, messageData.substring(0, messageData.length - 5));
                        this.reply(250, 'Ok');
                    } else {
                        this.reply(503, 'Bad sequence');
                    }

                    this.buffer = '';
                    this.receiveData = false;
                } else {
                    this.buffer += string;
                }
            }
        });
    }

    private reply(code: number, message: string) {
        this.socket.write(code + ' ' + message + ending);
    }

    private command(command: string, argument: string) {
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
                    this.receiveData = true;
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
