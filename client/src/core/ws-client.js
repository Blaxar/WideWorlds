/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {unpackEntityStates, serializeEntityState, deserializeEntityState}
  from '../../../common/ws-data-format.js';
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

/** Wrapped WebSocket connection to a world state channel */
class WorldState extends BaseWs {
  /**
   * @constructor
   * @param {WebSocket} ws - WebSocket client to wrap.
   */
  constructor(ws) {
    super(ws);
  }

  /**
   * Send entity state through the WebSocket client
   * @param {data} state - Plain entity state to serialize and send.
   */
  send(state) {
    this.ws.send(serializeEntityState(state));
  };

  /**
   * Register a callback for the 'message' event on the WebSocket client
   * @param {function} cb - Callback function to register.
   */
  onMessage(cb) {
    this.ws.addEventListener('message', (event) => {
      // Unpack individual entries first
      const states = unpackEntityStates(new Uint8Array(event.data));
      const entries = [];

      // Deserialize each individual entry and push it to the final list
      for (const state of states) {
        entries.push(deserializeEntityState(state));
      }

      // Pass the list of plain json objects to the callback
      cb(entries);
    });
  }
}

/** Wrapped WebSocket connection to a world update channel */
class WorldUpdate extends BaseWs {
  /**
   * @constructor
   * @param {WebSocket} ws - WebSocket client to wrap.
   */
  constructor(ws) {
    super(ws);
  }

  /**
   * Register a callback for the 'message' event on the WebSocket client
   * @param {function} cb - Callback function to register.
   */
  onMessage(cb) {
    this.ws.addEventListener('message', (event) => {
      // TODO: sanitize/check entries first?
      const entries = JSON.parse(event.data);

      // Pass the list of plain json objects to the callback
      cb(entries);
    });
  }
}

/** Main provider of WebSocket connections to various remote endpoints */
class WsClient {
  /**
   * @constructor
   * @param {string} baseUrl - Base API url to prepend to all API calls.
   * @param {string} token - JWT authentication token of the user.
   */
  constructor(baseUrl, token = null) {
    this.baseUrl = baseUrl;
    this.setAuthToken(token);
  }

  /**
   * Set the authentication token value to be used for WS requests
   * @param {string} token - User authetication token.
   */
  setAuthToken(token) {
    this.token = encodeURIComponent(token);
  }

  /** Clear current authentication token */
  clear() {
    this.token = null;
  }

  /**
   * Spawn a new world chat connection
   * @param {integer} id - ID of the world to connect to.
   * @return {Promise<WorldChat>} Promise of an already-opened WorldChat
   *                              connection.
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
   * @return {Promise<UserChat>} Promise of an already-opened UserChat
   *                             connection.
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

  /**
   * Spawn a new world state connection
   * @param {integer} id - ID of the world to connect to.
   * @return {Promise<WorldState>} Promise of an already-opened WorldState
   *                               connection.
   */
  worldStateConnect(id) {
    return new Promise((resolve, err) => {
      const ws = new WebSocket(
          `${this.baseUrl}/worlds/${id}/ws/state?token=${this.token}`,
      );
      ws.binaryType = 'arraybuffer';

      ws.addEventListener('error', (event) => {
        err(event);
      });

      ws.addEventListener('open', (event) => {
        resolve(new WorldState(ws));
      });
    });
  }

  /**
   * Spawn a new world update connection
   * @param {integer} id - ID of the world to connect to.
   * @return {Promise<WorldUpdate>} Promise of an already-opened WorldUpdate
   *                                connection.
   */
  worldUpdateConnect(id) {
    return new Promise((resolve, err) => {
      const ws = new WebSocket(
          `${this.baseUrl}/worlds/${id}/ws/update?token=${this.token}`,
      );

      ws.addEventListener('error', (event) => {
        err(event);
      });

      ws.addEventListener('open', (event) => {
        resolve(new WorldUpdate(ws));
      });
    });
  }
}

export default WsClient;
export {WorldChat, UserChat, WorldState, WorldUpdate};
