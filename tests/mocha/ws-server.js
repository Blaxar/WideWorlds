/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import makeHttpTestBase from '../utils.js';
import {serializeEntityState} from '../../common/ws-data-format.js';
import request from 'superwstest';
import * as assert from 'assert';

// Testing ws server

const dummySerializeEntityState = (id) => {
  const entityType = 1;
  const updateType = 2;
  const entityId = id;
  const x = 25.2;
  const y = 30.25;
  const z = -12.0;
  const yaw = 3.1415;
  const pitch = 1.2;
  const roll = 2.5;

  return new Uint8Array(serializeEntityState(entityType, updateType, entityId,
      x, y, z, yaw, pitch, roll).buffer);
};

describe('ws server', () => {
  const ctx = makeHttpTestBase();
  const base = ctx.base;

  before(ctx.before);

  beforeEach(ctx.beforeEach);

  afterEach(ctx.afterEach);

  after(ctx.after);

  it('WS user chat connect with headers - OK', async () => {
    // Ready the sender's connection to their own chat so they can be considered online
    const selfConnection = request(base.server).ws('/api/users/' + base.adminId + '/ws/chat')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .expectText(`{"delivered":true,"id":${base.adminId},"name":"xXx_B0b_xXx","role":"admin","msg":"What is up my dude?"}`); // Expect a feedback of our own message

    await Promise.all([
      // First: ready the receiver's chat by having them connect to their own private channel,
      // this is so we can assess the message was well received
      request(base.server).ws('/api/users/' + base.citizenId + '/ws/chat')
          .set('Authorization', 'Bearer ' + base.citizenBearerToken)
          .expectText(`{"delivered":true,"id":${base.adminId},"name":"xXx_B0b_xXx","role":"admin","msg":"What is up my dude?"}`) // Wait for the message to come in
          .close()
          .expectClosed(),
      // Second: ready the sender's connection to the receiver's chat and send the message
      request(base.server).ws('/api/users/' + base.citizenId + '/ws/chat')
          .set('Authorization', 'Bearer ' + base.adminBearerToken)
          .sendText('What is up my dude?') // Send the message
          .wait(100) // Wait for the other side to disconnect
          .sendText('Still there buddy?') // Send another message after the receiver went offline
          .close()
          .expectClosed(),
    ]);

    selfConnection.expectText(`{"delivered":false,"id":${base.adminId},"name":"xXx_B0b_xXx","role":"admin","msg":"Still there buddy?"}`) // Get notified that this one didn't get delivered
        .close().expectClosed();
  });

  it('WS user chat connect with parameters - OK', async () => {
    // Ready the sender's connection to their own chat so they can be considered online
    const selfConnection = request(base.server).ws('/api/users/' + base.adminId + '/ws/chat?token=' + encodeURIComponent(base.adminBearerToken))
        .expectText(`{"delivered":true,"id":${base.adminId},"name":"xXx_B0b_xXx","role":"admin","msg":"What is up my dude?"}`); // Expect a feedback of our own message

    await Promise.all([
      // First: ready the receiver's chat by having them connect to their own private channel,
      // this is so we can assess the message was well received
      request(base.server).ws('/api/users/' + base.citizenId + '/ws/chat?token=' + encodeURIComponent(base.citizenBearerToken))
          .expectText(`{"delivered":true,"id":${base.adminId},"name":"xXx_B0b_xXx","role":"admin","msg":"What is up my dude?"}`) // Wait for the message to come in
          .close()
          .expectClosed(),
      // Second: ready the sender's connection to the receiver's chat and send the message
      request(base.server).ws('/api/users/' + base.citizenId + '/ws/chat?token=' + encodeURIComponent(base.adminBearerToken))
          .sendText('What is up my dude?') // Send the message
          .wait(100) // Wait for the other side to disconnect
          .sendText('Still there buddy?') // Send another message after the receiver went offline
          .close()
          .expectClosed(),
    ]);

    selfConnection.expectText(`{"delivered":false,"id":${base.adminId},"name":"xXx_B0b_xXx","role":"admin","msg":"Still there buddy?"}`) // Get notified that this one didn't get delivered
        .close().expectClosed();
  });

  it('WS user chat connect with headers - Unauthorized', async () => {
    await request(base.server).ws('/api/users/' + base.citizenId + '/ws/chat')
        .set('Authorization', 'gibberish')
        .expectConnectionError(401);
  });

  it('WS user chat connect with parameters - Unauthorized', async () => {
    await request(base.server).ws('/api/users/' + base.citizenId + '/ws/chat?gibberish=' + 'gibberish')
        .expectConnectionError(401);
  });

  it('WS user chat connect with headers - Forbidden', async () => {
    await request(base.server).ws('/api/users/' + base.citizenId + '/ws/chat')
        .set('Authorization', 'Bearer iNvAlId')
        .expectConnectionError(403);
  });

  it('WS user chat connect with parameters - Forbidden', async () => {
    await request(base.server).ws('/api/users/' + base.citizenId + '/ws/chat?token=iNvAlId')
        .set('Authorization', 'Bearer iNvAlId')
        .expectConnectionError(403);
  });

  it('WS world chat connect with headers - OK', async () => {
    await request(base.server).ws('/api/worlds/' + base.worldId + '/ws/chat')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .sendText('What is up my dude?')
        .expectText(`{"delivered":true,"id":${base.adminId},"name":"xXx_B0b_xXx","role":"admin","msg":"What is up my dude?"}`)
        .close()
        .expectClosed();
  });

  it('WS world chat connect with parameters - OK', async () => {
    await request(base.server).ws('/api/worlds/' + base.worldId + '/ws/chat?token=' + base.adminBearerToken)
        .sendText('What is up my dude?')
        .expectText(`{"delivered":true,"id":${base.adminId},"name":"xXx_B0b_xXx","role":"admin","msg":"What is up my dude?"}`)
        .close()
        .expectClosed();
  });

  it('WS world chat connect with headers - Unauthorized', async () => {
    await request(base.server).ws('/api/worlds/' + base.worldId + '/ws/chat')
        .set('Authorization', 'gibberish')
        .expectConnectionError(401);
  });

  it('WS world chat connect with parameters - Unauthorized', async () => {
    await request(base.server).ws('/api/worlds/' + base.worldId + '/ws/chat?gibberish=' + 'gibberish')
        .expectConnectionError(401);
  });

  it('WS world chat connect with headers - Forbidden', async () => {
    await request(base.server).ws('/api/worlds/' + base.worldId + '/ws/chat')
        .set('Authorization', 'Bearer iNvAlId')
        .expectConnectionError(403);
  });

  it('WS world chat connect with parameters - Forbidden', async () => {
    await request(base.server).ws('/api/worlds/' + base.worldId + '/ws/chat?token=iNvAlId')
        .expectConnectionError(403);
  });

  it('WS world state connect with headers - OK', async () => {
    const state = dummySerializeEntityState(base.adminId);

    await request(base.server).ws('/api/worlds/' + base.worldId + '/ws/state')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .sendBinary(state)
        .expectBinary(state)
        .close()
        .expectClosed();
  });

  it('WS world state connect with parameters - OK', async () => {
    const state = dummySerializeEntityState(base.adminId);

    await request(base.server).ws('/api/worlds/' + base.worldId + '/ws/state?token=' + base.adminBearerToken)
        .sendBinary(state)
        .expectBinary(state)
        .close()
        .expectClosed();
  });

  it('WS world state connect with headers - Unauthorized', async () => {
    await request(base.server).ws('/api/worlds/' + base.worldId + '/ws/state')
        .set('Authorization', 'gibberish')
        .expectConnectionError(401);
  });

  it('WS world state connect with parameters - Unauthorized', async () => {
    await request(base.server).ws('/api/worlds/' + base.worldId + '/ws/state?gibberish=' + 'gibberish')
        .expectConnectionError(401);
  });

  it('WS world state connect with headers - Forbidden', async () => {
    await request(base.server).ws('/api/worlds/' + base.worldId + '/ws/state')
        .set('Authorization', 'Bearer iNvAlId')
        .expectConnectionError(403);
  });

  it('WS world state connect with parameters - Forbidden', async () => {
    await request(base.server).ws('/api/worlds/' + base.worldId + '/ws/state?token=iNvAlId')
        .expectConnectionError(403);
  });
});
