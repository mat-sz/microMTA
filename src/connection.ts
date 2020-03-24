import { Socket } from 'net';

import { microMTAOptions } from './options';
import { SMTPCommand } from './commands';

export class microMTAConnection {
    constructor(private socket: Socket, 
                private options: microMTAOptions,
                private onMessage: (recipients: string[], sender: string, message: string) => void,
                private onError: (error: Error) => void) {

        socket.setEncoding('utf8');

        this.reply(220, this.options.hostname + ' ESMTP microMTA');
        
        let buffer = '';
        let receiveData = false;
        let recipients: string[] = [];
        let sender: string;

        const ending = '\r\n';

        socket.on('error', err => this.onError(err));

        socket.on('data', data => {
            const string = data.toString();
            
            if (!receiveData && string.includes(ending)) {
                const commands = string.split(ending);
                commands[0] = buffer + commands[0];
                buffer = '';

                for (let i = 0; i < commands.length - 1; i++) {
                    const [ command, args ] = commands[i].split(' ', 2);
                    
                    switch (command) {
                        case SMTPCommand.HELO:
                            this.reply(250, this.options.hostname + ', greeting accepted.');
                            break;
                        case SMTPCommand.MAIL:
                            if (args.startsWith('FROM:<') && args.endsWith('>')) {
                                sender = args.substring(6, args.length - 1);
                                this.reply(250, 'Ok');
                            } else {
                                this.reply(501, 'Argument syntax error');
                            }
                            break;
                        case SMTPCommand.RCPT:
                            if (args.startsWith('TO:<') && args.endsWith('>')) {
                                recipients.push(args.substring(4, args.length - 1));
                                this.reply(250, 'Ok');
                            } else {
                                this.reply(501, 'Argument syntax error');
                            }
                            break;
                        case SMTPCommand.DATA:
                            if (recipients.length > 0 && sender) {
                                this.reply(354, 'End data with <CR><LF>.<CR><LF>');
                                receiveData = true;
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

                if (!string.endsWith(ending)) {
                    buffer = commands[commands.length - 1];
                }
            } else {
                if (receiveData && (buffer + string).includes('\r\n.\r\n')) {
                    this.onMessage(recipients, sender, buffer + string);
                    buffer = '';
                    receiveData = false;
                    this.reply(250, 'Ok');
                } else {
                    buffer += string;
                }
            }
        });
    }

    reply(code: number, message: string) {
        this.socket.write(code + ' ' + message + '\r\n');
    }
}
