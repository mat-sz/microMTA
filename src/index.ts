import { createServer, Server, Socket } from 'net';

import { SMTPCommand } from './SMTPCommand';

interface microMTAMessage {
    recipients: string[],
    sender: string,
    message: string,
};

type microMTAMessageEventListener = (this: microMTA, message: microMTAMessage) => void;
type microMTAErrorEventListener = (this: microMTA, error: Error) => void;

interface microMTAEvents {
    message: Set<microMTAMessageEventListener>,
    error: Set<microMTAErrorEventListener>,
};

export class microMTA {
    private server: Server;

    private events: microMTAEvents = {
        message: new Set(),
        error: new Set(),
    };

    constructor() {
        this.server = createServer(socket => this.connection(socket));
    }

    start() {
        this.server.listen(25);
    }

    stop() {
        this.server.close();
    }

    on(eventType: 'message', listener: microMTAMessageEventListener): void;

    on(eventType: 'error', listener: microMTAErrorEventListener): void;

    on(eventType: keyof microMTAEvents, listener: Function) {
        this.events[eventType].add(listener as any);
    }

    off(eventType: 'message', listener: microMTAMessageEventListener): void;

    off(eventType: 'error', listener: microMTAErrorEventListener): void;

    off(eventType: keyof microMTAEvents, listener: Function) {
        this.events[eventType].delete(listener as any);
    }

    private emit(eventType: keyof microMTAEvents, ...args: any[]) {
        for (let listener of this.events[eventType]) {
            (listener as Function).apply(this, args);
        }
    }

    private message(recipients: string[], sender: string, message: string) {
        this.emit('message', {
            recipients,
            sender,
            message,
        } as microMTAMessage);
    }

    private error(error: Error) {
        this.emit('error', error);
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

        socket.on('error', err => this.error(err));

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