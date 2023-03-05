/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import makeHttpTestBase, {sleep} from '../utils.js';
import {serializeEntityState, packEntityStates, deserializeEntityState, entityType}
  from '../../common/ws-data-format.js';
import * as assert from 'assert';
import WsClient from '../../client/src/core/ws-client.js';

// Testing ws client

const dummyEntityState = (id) => {
  const entityType = 1;
  const updateType = 2;
  const entityId = id;
  const x = 25.2;
  const y = 30.25;
  const z = -12.0;
  const yaw = 3.1415;
  const pitch = 1.2;
  const roll = 2.5;

  // Serialize and deserialize to ensure stable floating number precision
  return deserializeEntityState(serializeEntityState({entityType, updateType, entityId,
      x, y, z, yaw, pitch, roll}));
};

describe('ws client', () => {
  const ctx = makeHttpTestBase();
  const base = ctx.base;

  before(ctx.before);

  beforeEach(async () => {
    await ctx.beforeEach();
    base.wsChannelManager.startBroadcasting();
  });

  afterEach(async () => {
    base.wsChannelManager.stopBroadcasting();
    await ctx.afterEach();
  });

  after(ctx.after);

  it('world chat', async () => {
    const client = new WsClient(`ws://127.0.0.1:${base.port}/api`, base.citizenBearerToken);
    const chat = await client.worldChatConnect(base.worldId);
    let message = null;
    let closed = false;

    chat.onMessage((msg) => {
      message = msg;
    });

    chat.onClose((event) => {
      closed = true;
    });

    assert.strictEqual(message, null);
    assert.strictEqual(closed, false);

    chat.send('change da world  my final message. Goodb ye');
    await sleep(100);

    assert.equal(message, `{"delivered":true,"id":${base.citizenId},"name":"oOo_Al1ce_oOo","role":"citizen","msg":"change da world  my final message. Goodb ye"}`);

    chat.close();
    await sleep(100);

    assert.strictEqual(closed, true);
  });

  it('user chat', async () => {
    const citizenClient = new WsClient(`ws://127.0.0.1:${base.port}/api`, base.citizenBearerToken);
    const adminClient = new WsClient(`ws://127.0.0.1:${base.port}/api`, base.adminBearerToken);
    const citizenSelfChat = await citizenClient.userChatConnect(base.citizenId);
    const adminSelfChat = await adminClient.userChatConnect(base.adminId);
    const adminFromCitizenChat = await citizenClient.userChatConnect(base.adminId);
    const citizenFromAdminChat = await adminClient.userChatConnect(base.citizenId);
    let citizenMsg = null;
    let feedbackMsg = null;
    let closed = 0;

    adminSelfChat.onMessage((msg) => {
      citizenMsg = msg;
    });

    citizenSelfChat.onMessage((msg) => {
      feedbackMsg = msg;
    });

    adminSelfChat.onClose((event) => {
      closed++;
    });

    citizenSelfChat.onClose((event) => {
      closed++;
    });

    citizenFromAdminChat.onClose((event) => {
      closed++;
    });

    adminFromCitizenChat.onClose((event) => {
      closed++;
    });

    assert.strictEqual(citizenMsg, null);
    assert.strictEqual(feedbackMsg, null);
    assert.strictEqual(closed, 0);

    // Citizen sends a message on the admin chat
    adminFromCitizenChat.send('change da world  my final message. Goodb ye');
    await sleep(100);

    // Admin expects a message from the citizen
    assert.equal(citizenMsg, `{"delivered":true,"id":${base.citizenId},"name":"oOo_Al1ce_oOo","role":"citizen","msg":"change da world  my final message. Goodb ye"}`);

    // Citizen expects a feedback if their own message
    assert.equal(feedbackMsg, `{"delivered":true,"id":${base.citizenId},"name":"oOo_Al1ce_oOo","role":"citizen","msg":"change da world  my final message. Goodb ye"}`);

    adminFromCitizenChat.close();
    citizenFromAdminChat.close();
    adminSelfChat.close();
    citizenSelfChat.close();
    await sleep(100);

    assert.strictEqual(closed, 4);
  });

  it('world state', async () => {
    const state = dummyEntityState(base.citizenId);

    const client = new WsClient(`ws://127.0.0.1:${base.port}/api`, base.citizenBearerToken);
    const states = await client.worldStateConnect(base.worldId);
    let message = null;
    let closed = false;

    states.onMessage((msg) => {
      message = msg;
    });

    states.onClose((event) => {
      closed = true;
    });

    assert.strictEqual(message, null);
    assert.strictEqual(closed, false);

    states.send(state);
    await sleep(150);

    // The deserialized payloads should be identical
    assert.equal(message.length, 1);
    assert.equal(JSON.stringify(message[0]), JSON.stringify(state));

    states.close();
    await sleep(100);

    assert.strictEqual(closed, true);
  });
});
