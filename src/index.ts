import { createServer } from 'net';

enum SMTPCommand {
    HELO = 'HELO',
    MAIL = 'MAIL',
    RCPT = 'RCPT',
    DATA = 'DATA',
    QUIT = 'QUIT',
};

const server = createServer(socket => {
    socket.setEncoding('utf8');

    socket.write('220 localhost ESMTP microMTA\r\n');
    
    let buffer = '';
    let receiveData = false;

    const ending = '\r\n';

    socket.on('data', data => {
        const string = data.toString();
        
        if (!receiveData && string.includes(ending)) {
            const commands = string.split(ending);
            commands[0] = buffer + commands[0];
            buffer = '';

            for (let i = 0; i < commands.length - (string.endsWith(ending) ? 0 : 1); i++) {
                console.log(commands[i]);
                const [ command, args ] = commands[i].split(' ', 2);
                
                switch (command) {
                    case SMTPCommand.HELO:
                        socket.write('250 localhost, greeting accepted.\r\n');
                        break;
                    case SMTPCommand.MAIL:
                        socket.write('250 Ok\r\n');
                        break;
                    case SMTPCommand.RCPT:
                        socket.write('250 Ok\r\n');
                        break;
                    case SMTPCommand.DATA:
                        socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
                        receiveData = true;
                        break;
                    case SMTPCommand.QUIT:
                        socket.write('221 Bye\r\n');
                        break;
                }
            }

            if (!string.endsWith(ending)) {
                buffer = commands[commands.length - 1];
            }
        } else {
            if (receiveData && (buffer + string).includes('\r\n.\r\n')) {
                buffer = '';
                receiveData = false;
                socket.write('250 Ok\r\n');
            } else {
                buffer += string;
            }
        }
    });
});

server.listen(25);