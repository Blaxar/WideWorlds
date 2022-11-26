import makeHttpTestBase, {sleep} from '../utils.js';
import * as assert from 'assert';
import WsClient from '../../client/src/core/ws-client.js';

// Testing ws client

describe('ws chat', () => {
  const ctx = makeHttpTestBase();
  const base = ctx.base;

  before(ctx.before);

  beforeEach(ctx.beforeEach);

  afterEach(ctx.afterEach);

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
});
