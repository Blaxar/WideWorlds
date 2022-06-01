import url from 'url';
import {WebSocketServer} from 'ws';
import jwt from 'jsonwebtoken';

const bearerRegex = /^Bearer (.*)$/i;
const worldChatRegex = /^\/api\/worlds\/([0-9]+)\/ws\/chat$/;
const userChatRegex = /^\/api\/users\/([0-9]+)\/ws\/chat$/;

class WsChannelManager {
    constructor() {
        this.worldChannels = {};
        this.userChannels = {};
    }

    // Each world will have its own WS chat endpoint
    addWorldChatConnection(worldId, ws, clientId) {
        if (this.worldChannels[worldId] === undefined) {
            // No ongoing channel for this world, ready the base object first
            this.worldChannels[worldId] = { chat: {} };
        }

        this.worldChannels[worldId].chat[clientId] = ws;
    }

    removeWorldChatConnection(worldId, clientId) {
        delete this.worldChannels[worldId].chat[clientId];
    }

    sendWorldChatMessage(worldId, clientId, msg) {
        const worldChat = this.worldChannels[worldId]?.chat;
        if (worldChat === undefined) {
            throw('World not found, can\'t send message');
        }

        for (const [cid, ws] of Object.entries(worldChat)) {
            ws.send(msg);
        }
    }

    // Each user will have its own WS chat endpoint
    addUserChatConnection(userId, ws, clientId) {
        if (this.userChannels[userId] === undefined) {
            // No ongoing channel for this user, ready the base object first
            this.userChannels[userId] = { chat: {} };
        }

        this.userChannels[userId].chat[clientId] = ws;
    }

    removeUserChatConnection(userId, clientId) {
        delete this.userChannels[userId].chat[clientId];
    }
}

const spawnWsServer = async (server, secret) => {
    const channelManager = new WsChannelManager();
    const authenticate = (req, onError, onSuccess) => {
        // Get Bearer token, we strip the 'Bearer' part
        const authMatch = req.headers['authorization']?.match(bearerRegex);
        const token = authMatch && authMatch[1];

        if (token === null) {
            // We do not understand the credentials being provided at all (malformed)
            onError(401);
            return;
        }

        jwt.verify(token, secret, (err, payload) => {
            if (err) {
                // We aknowledge a Bearer token was provided to us, but it is not valid
                onError(403);
                return;
            }

            onSuccess(payload.userId);
        });
    };

    const wss = new WebSocketServer({noServer: true});

    wss.on('connection', (ws, request, entity, id, type, userId) => {
        if (entity == 'test') {
            ws.on('message', (data) => {
                // TODO: parse actual messages
                if (data == 'What is my id?') {
                    ws.send(userId);
                } else {
                    ws.send('???');
                }
            });
        } else if (entity == 'world') {
            channelManager.addWorldChatConnection(id, ws, userId);
            ws.on('close', () => { channelManager.removeWorldChatConnection(id, userId); });
            ws.on('message', (data) => { channelManager.sendWorldChatMessage(id, userId, new TextDecoder().decode(data)); });
        } else if (entity == 'user') {
            channelManager.addUserChatConnection(id, ws, userId);
            ws.on('close', () => { channelManager.removeUserChatConnection(id, userId); });
            ws.on('message', (data) => { /* TODO: broadcast message to private user chat using manager */ });
        }
    });

    server.on('upgrade', function upgrade(request, socket, head) {
        const { pathname } = url.parse(request.url);

        const worldMatch = pathname.match(worldChatRegex);
        const userMatch = pathname.match(userChatRegex);

        if (pathname != '/ws' && !worldMatch && !userMatch) {
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
                if (worldMatch) {
                    wss.emit('connection', ws, request, 'world', worldMatch[1], 'chat', userId);
                }
                else if (userMatch) {
                    wss.emit('connection', ws, request, 'user', userMatch[1], 'chat', userId);
                }
                else {
                    wss.emit('connection', ws, request, 'test', null, null, userId);
                }
            });
        });
    });

    return wss;
}

export {spawnWsServer};
