import {URL} from 'url';
import {WebSocketServer} from 'ws';
import jwt from 'jsonwebtoken';

const bearerRegex = /^Bearer (.*)$/i;
const worldChatRegex = /^\/api\/worlds\/([0-9]+)\/ws\/chat$/;
const userChatRegex = /^\/api\/users\/([0-9]+)\/ws\/chat$/;

const formatUserMessage = (delivered, id, name, role, msg) => JSON.stringify({delivered, id, name, role, msg});

class WsChannelManager {
    constructor(userCache) {
        this.userCache = userCache;
        this.worldChannels = {};
        this.userChannels = {};
    }

    // Each world will have its own WS chat endpoint
    addWorldChatConnection(worldId, ws, clientId) {
        if (this.worldChannels[worldId] === undefined) {
            // No ongoing channel for this world, ready the base object first
            this.worldChannels[worldId] = { chat: {} };
        }

        // Do not allow more than one connection per client, close the current one if any
        this.worldChannels[worldId].chat[clientId]?.close();

        this.worldChannels[worldId].chat[clientId] = ws;
    }

    removeWorldChatConnection(worldId, clientId) {
        this.worldChannels[worldId].chat[clientId].close();
        delete this.worldChannels[worldId].chat[clientId];
    }

    sendWorldChatMessage(clientId, worldId, msg) {
        const worldChat = this.worldChannels[worldId]?.chat;
        if (worldChat === undefined) {
            throw('World not found, can\'t send message');
        }

        const user = this.userCache.get(clientId);
        if (!user) throw('User not found, can\'t send message');

        const data = formatUserMessage(true, clientId, user.name, user.role, msg);
        for (const [cid, ws] of Object.entries(worldChat)) {
            ws.send(data);
        }
    }

    // Each user will have their on chat endpoint to receive messages on
    addUserChatConnection(ws, clientId) {
        // Do not allow more than one connection per client, close the current one if any
        this.userChannels[clientId]?.close();

        this.userChannels[clientId] = ws;
    }

    removeUserChatConnection(clientId) {
        this.userChannels[clientId]?.close();

        delete this.userChannels[clientId];
    }

    sendUserChatMessage(clientId, userId, msg) {
        const userChat = this.userChannels[userId];
        const clientChat = this.userChannels[clientId];

        if (clientChat === undefined) {
            throw('Source user not online, can\'t send message');
        }

        const user = this.userCache.get(clientId);
        if (!user) throw('Source user not found in cache, can\'t send message');

        let data = formatUserMessage(false, clientId, user.name, user.role, msg);
        if (userChat === undefined) {
            // Destination user is offline, notify sender about failure
            clientChat.send(data);
            return;
        }

        // Destination user is online
        data = formatUserMessage(true, clientId, user.name, user.role, msg);

        // We don't intend to broadcast to everyone... So we reply to the destination user but also
        // to the original sender as well for the sake of providing them feedback of their own sending
        userChat.send(data);
        clientChat.send(data);
    }
}

const spawnWsServer = async (server, secret, userCache) => {
    const channelManager = new WsChannelManager(userCache);
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
        if (entity == 'world') {
            channelManager.addWorldChatConnection(id, ws, userId);
            ws.on('close', () => { channelManager.removeWorldChatConnection(id, userId); });
            ws.on('message', (data) => { channelManager.sendWorldChatMessage(userId, id, new TextDecoder().decode(data)); });
        } else if (entity == 'user') {
            channelManager.addUserChatConnection(ws, userId);
            ws.on('close', () => { channelManager.removeUserChatConnection(userId); });
            ws.on('message', (data) => { channelManager.sendUserChatMessage(userId, id, new TextDecoder().decode(data)); });
        }
    });

    server.on('upgrade', function upgrade(request, socket, head) {
        const { pathname, searchParams } = new URL(request.url, 'https://wideworlds.org'); // We don't care about the base

        const worldMatch = pathname.match(worldChatRegex);
        const userMatch = pathname.match(userChatRegex);

        if (!worldMatch && !userMatch) {
            socket.destroy();
            return;
        }

        // We expect a valid JWT token provided either in the header of the request or as url parameter
        if (!request.headers['authorization'])
        {
            // No headers token, try to fetch one from the parameters
            const paramToken = searchParams.get('token');

            if (paramToken)
            {
                request.headers['authorization'] = 'Bearer ' + decodeURIComponent(searchParams.get('token'));
            }
            else
            {
                // No parameters, can't go further
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }
        }

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
            });
        });
    });

    return wss;
};

export {spawnWsServer};
