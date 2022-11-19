import WebSocket from 'ws';

class BaseWs {
    constructor(ws) {
        this.ws = ws;
    }

    onMessage(cb) {
        this.ws.addEventListener('message', event => {
            cb(event.data);
        });
    }

    onClose(cb) {
        this.ws.addEventListener('close', event => {
            cb((({code, reason, wasClean}) => ({code, reason, wasClean}))(event));
        });
    }

    send(msg) {
        this.ws.send(msg);
    };

    close() {
        this.ws.close();
    }
}

class WorldChat extends BaseWs {
    constructor(ws) {
        super(ws);
    }
}

class UserChat extends BaseWs {
    constructor(ws) {
        super(ws);
    }
}

class WsClient {
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl;
        this.token = encodeURIComponent(token);
    }

    worldChatConnect(id) {
        return new Promise((resolve, err) => {
            const ws = new WebSocket(`${this.baseUrl}/api/worlds/${id}/ws/chat?token=${this.token}`);

            ws.addEventListener('error', event => {
                err(event);
            });

            ws.addEventListener('open', event => {
                resolve(new WorldChat(ws));
            });
        });
    }

    userChatConnect(id) {
        return new Promise((resolve, err) => {
            const ws = new WebSocket(`${this.baseUrl}/api/users/${id}/ws/chat?token=${this.token}`);

            ws.addEventListener('error', event => {
                err(event);
            });

            ws.addEventListener('open', event => {
                resolve(new UserChat(ws));
            });
        });
    }
}

export default WsClient;
export {WorldChat, UserChat};
