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
        socket.write('220 localhost ESMTP microMTA\r\n');
        
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
                            socket.write('250 localhost, greeting accepted.\r\n');
                            break;
                        case SMTPCommand.MAIL:
                            if (args.startsWith('FROM:<') && args.endsWith('>')) {
                                sender = args.substring(6, args.length - 1);
                                socket.write('250 Ok\r\n');   
                            } else {
                                socket.write('501 Argument syntax error\r\n');
                            }
                            break;
                        case SMTPCommand.RCPT:
                            if (args.startsWith('TO:<') && args.endsWith('>')) {
                                recipients.push(args.substring(4, args.length - 1));
                                socket.write('250 Ok\r\n');   
                            } else {
                                socket.write('501 Argument syntax error\r\n');
                            }
                            break;
                        case SMTPCommand.DATA:
                            if (recipients.length > 0 && sender) {
                                socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
                                receiveData = true;
                            } else {
                                socket.write('503 Bad sequence\r\n');
                            }
                            break;
                        case SMTPCommand.QUIT:
                            socket.write('221 Bye\r\n');
                            break;
                        default:
                            socket.write('502 Not implemented\r\n');
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
                    socket.write('250 Ok\r\n');
                } else {
                    buffer += string;
                }
            }
        });
    }
}