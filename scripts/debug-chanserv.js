import net from 'net';

const client = new net.Socket();
const config = {
    host: 'localhost',
    port: 6667,
    nick: 'DebugBot',
    user: 'debug',
    realname: 'Debug Bot'
};

client.connect(config.port, config.host, () => {
    console.log('Connected');
    client.write(`NICK ${config.nick}\r\n`);
    client.write(`USER ${config.user} 0 * :${config.realname}\r\n`);
});

client.on('data', (data) => {
    const lines = data.toString().split('\r\n');
    lines.forEach(line => {
        if (!line) return;
        console.log('< ' + line);

        const parts = line.split(' ');

        if (parts[0] === 'PING') {
            client.write(`PONG ${parts[1]}\r\n`);
        }

        if (parts[1] === '001') {
            console.log('> JOIN #debug-test');
            client.write('JOIN #debug-test\r\n');
        }

        if (parts[1] === 'JOIN' && line.includes(config.nick)) {
            console.log('> REGISTER #debug-test');
            client.write('PRIVMSG ChanServ :REGISTER #debug-test\r\n');

            setTimeout(() => {
                console.log('> SET FOUNDER');
                // Creating a dummy second user "dohmboy" isn't easy here without a second connection.
                // But we can try to set FOUNDER to ourselves slightly differently or just see HELP
                client.write('PRIVMSG ChanServ :HELP SET\r\n');
                client.write('PRIVMSG ChanServ :HELP REGISTER\r\n');
            }, 1000);

            setTimeout(() => {
                client.end();
            }, 5000);
        }
    });
});

client.on('close', () => {
    console.log('Connection closed');
});

client.on('error', (err) => {
    console.error('Error:', err);
});
