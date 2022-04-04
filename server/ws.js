const url = require("url");
const ws = require('ws');
const jwt = require('jsonwebtoken');

const bearerRegex = /^Bearer (.*)$/i;

const spawnWsServer = async (server, secret) => {
    const authenticate = (req, onError, onSuccess) => {
        // Get Bearer token, we strip the 'Bearer' part
        const authMatch = req.headers['authorization']?.match(bearerRegex);
        const token = authMatch && authMatch[1];

        if (token === null) {
            // We do not understand the credentials being provided at all (malformed)
            onError(401);
            return;
        }

        jwt.verify(token, secret, (err, userId) => {
            if (err) {
                // We aknowledge a Bearer token was provided to us, but it is not valid
                onError(403);
                return;
            }

            onSuccess(userId);
        });
    };

    const wss = new ws.WebSocket.Server({noServer: true});

    wss.on('connection', (ws, request, userId) => {
        ws.on('message', (data) => {
            // TODO: parse actual messages
            if (data == 'What is my id?') {
                ws.send(userId);
            } else {
                ws.send('???');
            }
        });
    });

    server.on('upgrade', function upgrade(request, socket, head) {
        const { pathname } = url.parse(request.url);

        if (pathname != '/ws') {
            socket.destroy();
            return;
        }

        // We expect a valid JWT token provided in the header of the request
        authenticate(request, (err) => {
            if (err == 401) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            } else if (err == 403) {
                socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            }
            socket.destroy();
            return;
        },
        (userId) => {
            // The token is valid, we can upgrade to an actual Websocket connection             
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request, userId);
            });
        });
    });

    return wss;
}

module.exports = spawnWsServer;
