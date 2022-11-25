import WebSocket from 'isomorphic-ws';

/** Base class for all WebSocket client wrappers */
class BaseWs {
  /**
   * @constructor
   * @param {WebSocket} ws - WebSocket client to wrap.
   */
  constructor(ws) {
    this.ws = ws;
  }

  /**
   * Register a callback for the 'message' event on the WebSocket client
   * @param {function} cb - Callback function to register.
   */
  onMessage(cb) {
    this.ws.addEventListener('message', (event) => {
      cb(event.data);
    });
  }

  /**
   * Register a callback for the 'close' event on the WebSocket client
   * @param {function} cb - Callback function to register.
   */
  onClose(cb) {
    this.ws.addEventListener('close', (event) => {
      cb((({code, reason, wasClean}) => ({code, reason, wasClean}))(event));
    });
  }

  /**
   * Send message through the WebSocket client
   * @param {data} msg - Message to send.
   */
  send(msg) {
    this.ws.send(msg);
  };

  /** Close the WebSocket client connection */
  close() {
    this.ws.close();
  }
}

/** Wrapped WebSocket connection to a world chat */
class WorldChat extends BaseWs {
  /**
   * @constructor
   * @param {WebSocket} ws - WebSocket client to wrap.
   */
  constructor(ws) {
    super(ws);
  }
}

/** Wrapped WebSocket connection to a user chat */
class UserChat extends BaseWs {
  /**
   * @constructor
   * @param {WebSocket} ws - WebSocket client to wrap.
   */
  constructor(ws) {
    super(ws);
  }
}

/** Main provider of WebSocket connections to various remote endpoints */
class WsClient {
  /**
   * @constructor
   * @param {string} baseUrl - Base API url to prepend to all API calls.
   * @param {string} token - JWT authentication token of the user.
   */
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = encodeURIComponent(token);
  }

  /**
   * Spawn a new world chat connection
   * @param {integer} id - ID of the world to connect to.
   * @return {Promise} Promise of an already-opened WorldChat connection.
   */
  worldChatConnect(id) {
    return new Promise((resolve, err) => {
      const ws = new WebSocket(
          `${this.baseUrl}/worlds/${id}/ws/chat?token=${this.token}`,
      );

      ws.addEventListener('error', (event) => {
        err(event);
      });

      ws.addEventListener('open', (event) => {
        resolve(new WorldChat(ws));
      });
    });
  }

  /**
   * Spawn a new user chat connection
   * @param {integer} id - ID of the user to connect to.
   * @return {Promise} Promise of an already-opened UserChat connection.
   */
  userChatConnect(id) {
    return new Promise((resolve, err) => {
      const ws = new WebSocket(
          `${this.baseUrl}/users/${id}/ws/chat?token=${this.token}`,
      );

      ws.addEventListener('error', (event) => {
        err(event);
      });

      ws.addEventListener('open', (event) => {
        resolve(new UserChat(ws));
      });
    });
  }
}

export default WsClient;
export {WorldChat, UserChat};
