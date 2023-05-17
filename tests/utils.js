/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import * as db from '../common/db/utils.js';
import {spawnHttpServer} from '../server/http.js';
import {spawnWsServer} from '../server/ws.js';
import World from '../common/db/model/World.js';
import Prop from '../common/db/model/Prop.js';
import User from '../common/db/model/User.js';
import request from 'superwstest';
import * as assert from 'assert';
import * as fs from 'fs';
import * as crypto from 'crypto';
import TypeORM from 'typeorm';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const makeTestWorld = async (connection, name, data) => {
  return (await connection.manager.save([new World(undefined, name, data)]))[0].id;
};

const makeTestUser = async (connection, name, password, email, role) => {
  const salt = crypto.randomBytes(db.saltLength).toString('base64');

  const user = new User(undefined, name, db.hashPassword(password, salt), email, role, salt);
  return (await connection.manager.save([user]))[0].id;
};

const makeTestProp = async (connection, worldId, userId, date, x, y, z, yaw,
    pitch, roll, name, description, action) => {
  return (await connection.manager.save([new Prop(undefined, worldId, userId, date, x, y, z,
      yaw, pitch, roll, name, description, action)]))[0].id;
};

const makeHttpTestBase = (port = 62931, dbFile = 'mocha-http-test-db.sqlite3', secret = crypto.randomBytes(64).toString('hex')) => {
  const base = {
    port,
    dbFile,
    secret,
    server: null,
    wss: null,
    wsChannelManager: null,
    connection: null,
    worldId: null,
    adminId: 0,
    citizenId: 0,
    now: 0,
    adminBearerToken: '',
    citizenBearerToken: '',
    worldFolder: join(tmpdir(), `base${Date.now()}`),
    userCache: new Map(),
    terrainCache: new Map()
  };

  const before = async () => {
    if (fs.existsSync(base.dbFile)) {
      throw("Test database file already exists, move it or delete it first.");
    }

    base.server = await spawnHttpServer(base.dbFile, base.port, base.secret, base.worldFolder,
        base.userCache, base.terrainCache);
    const wsServer = await spawnWsServer(base.server, base.secret, base.userCache);
    base.wss = wsServer.ws;
    base.wsChannelManager = wsServer.wsChannelManager;
  };

  const beforeEach = async () => {
    // Create world in database, get its ID back
    base.worldId = await makeTestWorld(TypeORM.getConnection(), 'Test World', '{}');

    // Create users in database, get their IDs back
    base.adminId = await makeTestUser(TypeORM.getConnection(), 'xXx_B0b_xXx', '3p1cP4sSw0Rd', 'test@somemail.com', 'admin');
    base.citizenId = await makeTestUser(TypeORM.getConnection(), 'oOo_Al1ce_oOo', '3p1cP4sSw0Rd', 'test2@somemail.com', 'citizen');

    base.userCache.set(base.adminId, {name: 'xXx_B0b_xXx', role: 'admin'});
    base.userCache.set(base.citizenId, {name: 'oOo_Al1ce_oOo', role: 'citizen'});

    base.adminBearerToken = await request(base.server)
      .post('/api/login')
      .send({username: 'xXx_B0b_xXx', password: '3p1cP4sSw0Rd'})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200).then(async response => {
        const body = response.body;

        assert.equal(body.id, base.adminId);
        assert.ok(body.token);
        return body.token;
      });

    base.citizenBearerToken = await request(base.server)
      .post('/api/login')
      .send({username: 'oOo_Al1ce_oOo', password: '3p1cP4sSw0Rd'})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200).then(async response => {
        const body = response.body;

        assert.equal(body.id, base.citizenId);
        assert.ok(body.token);
        return body.token;
      });

    base.now = Date.now();

    // Fill-in database with a few props belonging to the world right above
    await makeTestProp(TypeORM.getConnection(), base.worldId, base.adminId, base.now, 0, 0, 0, 0, 0, 0,
        'wall01.rwx', 'Some description.', 'create color red;');
    await makeTestProp(TypeORM.getConnection(), base.worldId, base.adminId, base.now, 100, -200, 300, 450, 900, 1350,
        'wall02.rwx', 'Some other description.', 'create color blue;');
  };

  const afterEach = async () => {
    // Fetch all the entities
    const entities = TypeORM.getConnection().entityMetadatas;

    // Clear them all
    for (const entity of entities) {
      const repository = TypeORM.getConnection().getRepository(entity.name);
      await repository.clear();
    }

    base.userCache.clear();
  };

  const after = async () => {
    await base.server.close();
    fs.unlinkSync(base.dbFile);

    // Wait for everything to be properly closed
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return {base, before, after, beforeEach, afterEach};
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const epsEqual = (val, ref, eps = 0.001) => (val < ref + eps && val > ref - eps);

export default makeHttpTestBase;
export {makeTestWorld, makeTestUser, makeTestProp, sleep, epsEqual};
