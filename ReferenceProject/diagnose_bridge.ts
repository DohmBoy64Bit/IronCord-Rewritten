import io from 'socket.io-client';
// @ts-ignore
import jwt from 'jsonwebtoken';

const GATEWAY_URL = 'http://localhost:3000';
const JWT_SECRET = 'ironcord_secret_key_change_me';
const USER_ID = '00000000-0000-0000-0000-000000000000'; // Mock UUID

// 1. Generate Token
const token = jwt.sign({ userId: USER_ID }, JWT_SECRET);

// 2. Connect WebSocket
console.log('Connecting to WebSocket...');
const socket = io(GATEWAY_URL, {
    auth: { token },
});

socket.on('connect', () => {
    console.log('✅ WebSocket Connected');

    // 3. Register IRC Mock
    socket.emit('irc:connect', {
        config: {
            nick: 'TestBot',
            username: 'TestBot',
            gecos: 'Test Bot',
            server: 'irc',
            port: 6667
        }
    });
});

socket.on('irc:registered', async () => {
    console.log('✅ IRC Registered (Simulated)');

    // 4. Trigger Channel Creation
    console.log('Creating Channel via API...');
    try {
        const res = await fetch(`${GATEWAY_URL}/guilds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: `TestGuild-${Date.now()}` })
        });

        if (res.ok) {
            console.log('✅ Guild Created via API');
        } else {
            console.error('❌ Guild Creation Failed:', await res.text());
        }
    } catch (err) {
        console.error('❌ API Request Failed:', err);
    }
});

socket.on('irc:error', (err: any) => {
    console.log('ℹ️ IRC Error (Expected if Ergo not reachable from script):', err);
});

console.log('Diagnostic script running. Watch Gateway logs for "WS-INTERNAL" events.');
