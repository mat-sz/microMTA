import { createServer, Server, Socket } from 'net';

import { SMTPCommand } from './SMTPCommand';

export class microMTA {
    private server: Server;

    constructor() {
        this.server = createServer(socket => this.connection(socket));
    }

    public start() {
        this.server.listen(25);
    }

    public stop() {
        this.server.close();
    }

    private message(recipients: string[], sender: string, message: string) {
    }

    private connection(socket: Socket) {
        socket.setEncoding('utf8');
        const reply = (code: number, message: string) => {
            socket.write(code + ' ' + message + '\r\n');
        };

        reply(220, 'localhost ESMTP microMTA');
        
        let buffer = '';
        let receiveData = false;
        let recipients: string[] = [];
        let sender: string = undefined;

        const ending = '\r\n';

        socket.on('error', err => {
            // For now, ignore.
        });

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
                            reply(250, 'localhost, greeting accepted.');
                            break;
                        case SMTPCommand.MAIL:
                            if (args.startsWith('FROM:<') && args.endsWith('>')) {
                                sender = args.substring(6, args.length - 1);
                                reply(250, 'Ok');
                            } else {
                                reply(501, 'Argument syntax error');
                            }
                            break;
                        case SMTPCommand.RCPT:
                            if (args.startsWith('TO:<') && args.endsWith('>')) {
                                recipients.push(args.substring(4, args.length - 1));
                                reply(250, 'Ok');
                            } else {
                                reply(501, 'Argument syntax error');
                            }
                            break;
                        case SMTPCommand.DATA:
                            if (recipients.length > 0 && sender) {
                                reply(354, 'End data with <CR><LF>.<CR><LF>');
                                receiveData = true;
                            } else {
                                reply(503, 'Bad sequence');
                            }
                            break;
                        case SMTPCommand.QUIT:
                            reply(221, 'Bye');
                            break;
                        default:
                            reply(502, 'Not implemented');
                    }
                }

                if (!string.endsWith(ending)) {
                    buffer = commands[commands.length - 1];
                }
            } else {
                if (receiveData && (buffer + string).includes('\r\n.\r\n')) {
                    this.message(recipients, sender, buffer + string);
                    buffer = '';
                    receiveData = false;
                    reply(250, 'Ok');
                } else {
                    buffer += string;
                }
            }
        });
    }
}