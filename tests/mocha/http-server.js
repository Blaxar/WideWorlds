/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {defaultPageDiameter} from '../../common/terrain-utils.js';
import User from '../../common/db/model/User.js';
import * as db from '../../common/db/utils.js';
import makeHttpTestBase from '../utils.js';
import TypeORM from 'typeorm';
import request from 'superwstest';
import * as assert from 'assert';
import {join} from 'node:path';
import * as fs from 'fs';

// Testing http server

describe('http server', () => {
  const ctx = makeHttpTestBase();
  const base = ctx.base;

  before(ctx.before);

  beforeEach(ctx.beforeEach);

  afterEach(ctx.afterEach);

  after(ctx.after);

  it('POST /api/login - OK', (done) => {
    request(base.server)
        .post('/api/login')
        .send({username: 'xXx_B0b_xXx', password: '3p1cP4sSw0Rd'})
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then((response) => {
          const body = response.body;

          assert.equal(body.id, base.adminId);
          assert.ok(body.token);

          done();
        })
        .catch((err) => done(err));
  });

  it('POST /api/login - Unauthorized', (done) => {
    request(base.server)
        .post('/api/login')
        .send({username: 'xXx_B0b_xXx', password: 'UwU'})
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401, done);
  });

  // Testing World API

  it('GET /api/worlds - OK', (done) => {
    request(base.server)
        .get('/api/worlds')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].id, base.worldId);
          assert.equal(body[0].name, 'Test World');
          assert.equal(body[0].data, '{}');

          done();
        })
        .catch((err) => done(err));
  });

  it('GET /api/worlds - Unauthorized', (done) => {
    request(base.server)
        .get('/api/worlds')
        .set('Authorization', 'gibberish')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401, done);
  });

  it('GET /api/worlds - Forbidden', (done) => {
    request(base.server)
        .get('/api/worlds')
        .set('Authorization', 'Bearer iNvAlId')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('GET /api/worlds/id - OK', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId)
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then((response) => {
          const body = response.body;

          assert.equal(body.id, base.worldId);
          assert.equal(body.name, 'Test World');
          assert.equal(body.data, '{}');

          done();
        })
        .catch((err) => done(err));
  });

  it('GET /api/worlds/id - Unauthorized', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId)
        .set('Authorization', 'gibberish')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401, done);
  });

  it('GET /api/worlds/id - Forbidden', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId)
        .set('Authorization', 'Bearer iNvAlId')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('GET /api/worlds/id - Not Found', (done) => {
    request(base.server)
        .get('/api/worlds/66666')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404, done);
  });

  // Testing terrain API

  it('GET /api/worlds/id/terrain/x/z/elevation - OK', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId + '/terrain/-3/1/elevation')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .expect('Content-Type', /octet-stream/)
        .expect(200).then((response) => {
          const pageSize = defaultPageDiameter * defaultPageDiameter;
          assert.strictEqual(response.body.length, pageSize * 2 + 2);
          done();
        })
        .catch((err) => done(err));
  });

  it('GET /api/worlds/id/terrain/x/z/elevation - Not Found', (done) => {
    request(base.server)
      .get('/api/worlds/' + (base.worldId + 3000) + '/terrain/a/b/elevation')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
      .expect(404, done);
  });

  it('GET /api/worlds/id/terrain/x/z/elevation - Unauthorized', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId + '/terrain/-2/5/elevation')
        .set('Authorization', 'gibberish')
        .expect(401, done);
  });

  it('GET /api/worlds/id/terrain/x/z/elevation - Forbidden', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId + '/terrain/-2/5/elevation')
        .set('Authorization', 'Bearer iNvAlId')
        .expect(403, done);
  });

  it('GET /api/worlds/id/terrain/x/z/texture - OK', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId + '/terrain/-3/1/texture')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .expect('Content-Type', /octet-stream/)
        .expect(200).then((response) => {
          const pageSize = defaultPageDiameter * defaultPageDiameter;
          assert.strictEqual(response.body.length, pageSize);
          done();
        })
        .catch((err) => done(err));
  });

  it('GET /api/worlds/id/terrain/x/z/texture - Not Found', (done) => {
    request(base.server)
      .get('/api/worlds/' + base.worldId + '/terrain/a/b/texture.png')
      .set('Authorization', 'Bearer ' + base.adminBearerToken)
      .expect(404, done);;
  });

  it('GET /api/worlds/id/terrain/x/z/texture - Unauthorized', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId + '/terrain/-2/5/texture')
        .set('Authorization', 'gibberish')
        .expect(401, done);
  });

  it('GET /api/worlds/id/terrain/x/z/texture - Forbidden', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId + '/terrain/-2/5/texture')
        .set('Authorization', 'Bearer iNvAlId')
        .expect(403, done);
  });

  // Testing water API

  it('GET /api/worlds/id/water/x/z - OK', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId + '/water/-3/1')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .expect('Content-Type', /octet-stream/)
        .expect(200).then((response) => {
          const pageSize = defaultPageDiameter * defaultPageDiameter;
          assert.strictEqual(response.body.length, pageSize * 2 + 2);
          done();
        })
        .catch((err) => done(err));
  });

  it('GET /api/worlds/id/water/x/z - Not Found', (done) => {
    request(base.server)
      .get('/api/worlds/' + (base.worldId + 3000) + '/water/a/b')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
      .expect(404, done);
  });

  it('GET /api/worlds/id/water/x/z - Unauthorized', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId + '/water/-2/5')
        .set('Authorization', 'gibberish')
        .expect(401, done);
  });

  it('GET /api/worlds/id/water/x/z - Forbidden', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId + '/water/-2/5')
        .set('Authorization', 'Bearer iNvAlId')
        .expect(403, done);
  });

  // Testing User API (as admin)

  it('GET /api/users (as admin) - OK (all)', (done) => {
    request(base.server)
        .get('/api/users')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 2);

          assert.equal(body[0].id, base.adminId);
          assert.equal(body[0].name, 'xXx_B0b_xXx');
          assert.equal(body[0].email, 'test@somemail.com');
          assert.equal(body[0].role, 'admin');

          assert.equal(body[1].id, base.citizenId);
          assert.equal(body[1].name, 'oOo_Al1ce_oOo');
          assert.equal(body[1].email, 'test2@somemail.com');
          assert.equal(body[1].role, 'citizen');

          done();
        })
        .catch((err) => done(err));
  });

  it('GET /api/users (as admin) - OK (first page)', (done) => {
    request(base.server)
        .get('/api/users?amount=1')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].id, base.adminId);
          assert.equal(body[0].name, 'xXx_B0b_xXx');
          assert.equal(body[0].email, 'test@somemail.com');
          assert.equal(body[0].role, 'admin');

          done();
        })
        .catch((err) => done(err));
  });

  it('GET /api/users (as admin) - OK (second page)', (done) => {
    request(base.server)
        .get('/api/users?amount=1&page=1')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].id, base.citizenId);
          assert.equal(body[0].name, 'oOo_Al1ce_oOo');
          assert.equal(body[0].email, 'test2@somemail.com');
          assert.equal(body[0].role, 'citizen');

          done();
        })
        .catch((err) => done(err));
  });

  it('GET /api/users (as admin) - Bad Request', (done) => {
    request(base.server)
        .get('/api/users?amount=-1000000')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400, done);
  });

  it('GET /api/users (as admin) - Unauthorized', (done) => {
    request(base.server)
        .get('/api/users')
        .set('Authorization', 'gibberish')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401, done);
  });

  it('GET /api/users (as admin) - Forbidden', (done) => {
    request(base.server)
        .get('/api/users')
        .set('Authorization', 'Bearer iNvAlId')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('GET /api/users/id (as admin) - OK (self)', (done) => {
    request(base.server)
        .get('/api/users/' + base.adminId)
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then((response) => {
          const body = response.body;

          assert.equal(body.id, base.adminId);
          assert.equal(body.name, 'xXx_B0b_xXx');
          assert.equal(body.email, 'test@somemail.com');
          assert.equal(body.role, 'admin');

          done();
        })
        .catch((err) => done(err));
  });

  it('GET /api/users/id (as admin) - OK (someone else)', (done) => {
    request(base.server)
        .get('/api/users/' + base.citizenId)
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then((response) => {
          const body = response.body;

          assert.equal(body.id, base.citizenId);
          assert.equal(body.name, 'oOo_Al1ce_oOo');
          assert.equal(body.email, 'test2@somemail.com');
          assert.equal(body.role, 'citizen');

          done();
        })
        .catch((err) => done(err));
  });

  it('GET /api/users/id (as admin) - Unauthorized', (done) => {
    request(base.server)
        .get('/api/users/' + base.adminId)
        .set('Authorization', 'gibberish')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401, done);
  });

  it('GET /api/users/id (as admin) - Forbidden', (done) => {
    request(base.server)
        .get('/api/users/' + base.adminId)
        .set('Authorization', 'Bearer iNvAlId')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('GET /api/users/id (as admin) - Not Found', (done) => {
    request(base.server)
        .get('/api/users/66666')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404).then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'invalidParamsId');
          assert.equal(body[0].ctx, 'params');
          assert.equal(body[0].field, 'id');

          done();
        }).catch((err) => done(err));
  });

  it('POST /api/users (as admin) - Bad Request (missing field)', (done) => {
    request(base.server)
        .post('/api/users')
        .send({
          name: 'Ig0r-R0xX0r',
          email: 'igor@ok.net',
          role: 'citizen',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400).then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'invalidBodyPassword');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'password');

          done();
        })
        .catch((err) => done(err));
  });

  it('POST /api/users (as admin) - Bad Request (invalid role)', (done) => {
    request(base.server)
        .post('/api/users')
        .send({
          name: 'Ig0r-R0xX0r',
          email: 'igor@ok.net',
          password: '1mN0tB0b',
          role: 'god',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'invalidBodyRole');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'role');

          done();
        })
        .catch((err) => done(err));
  });

  it('POST /api/users (as admin) - Bad Request (invalid format)', (done) => {
    request(base.server)
        .post('/api/users')
        .send({
          name: 1337,
          email: 'igor@ok.net',
          password: '1mN0tB0b',
          role: 'citizen',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'invalidBodyName');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'name');

          done();
        })
        .catch((err) => done(err));
  });

  it('POST /api/users (as admin) - Bad Request (passwords identical)', (done) => {
    request(base.server)
        .post('/api/users')
        .send({
          name: 'Ig0r-R0xX0r',
          email: 'igor@ok.net',
          password: '1mN0tB0b',
          privilegePassword: '1mN0tB0b',
          role: 'citizen',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'invalidBodyPrivilegePassword');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'privilegePassword');

          done();
        })
        .catch((err) => done(err));
  });

  it('POST /api/users (as admin) - Bad Request (name already taken)', (done) => {
    request(base.server)
        .post('/api/users')
        .send({
          name: 'oOo_Al1ce_oOo',
          email: 'igor@ok.net',
          password: '1mN0tB0b',
          role: 'citizen',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'nonUniqueBodyName');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'name');

          done();
        })
        .catch((err) => done(err));
  });

  it('POST /api/users (as admin) - Bad Request (email already taken)', (done) => {
    request(base.server)
        .post('/api/users')
        .send({
          name: 'Ig0r-R0xX0r',
          email: 'test2@somemail.com',
          password: '1mN0tB0b',
          role: 'citizen',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'nonUniqueBodyEmail');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'email');

          done();
        })
        .catch((err) => done(err));
  });

  it('POST /api/users (as admin) - Bad Request (invalid email)', (done) => {
    request(base.server)
        .post('/api/users')
        .send({
          name: 'Ig0r-R0xX0r',
          email: 'Not an email address',
          password: '1mN0tB0b',
          role: 'citizen',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'invalidBodyEmail');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'email');

          done();
        })
        .catch((err) => done(err));
  });

  it('POST /api/users (as admin) - OK', (done) => {
    request(base.server)
        .post('/api/users')
        .send({
          name: 'Ig0r-R0xX0r',
          password: '1mN0tB0b',
          email: 'igor@ok.net',
          role: 'citizen',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then(async (response) => {
          const body = response.body;

          assert.notEqual(body.id, base.adminId);
          assert.notEqual(body.id, base.citizenId);
          assert.equal(body.name, 'Ig0r-R0xX0r');
          assert.equal(body.email, 'igor@ok.net');
          assert.equal(body.role, 'citizen');

          await TypeORM.getConnection().manager.createQueryBuilder(User, 'user')
              .where('user.id = :uid', {uid: body.id}).getOne()
              .then((user) => {
                // Assert fields
                assert.equal(user.id, body.id);
                assert.equal(user.name, 'Ig0r-R0xX0r');
                assert.equal(user.password, db.hashPassword('1mN0tB0b', user.salt));
                assert.equal(user.email, 'igor@ok.net');
                assert.equal(user.role, 'citizen');

                done();
              }).catch((err) => done(err));
        })
        .catch((err) => done(err));
  });

  it('POST /api/users (as admin) - OK with privilege password', (done) => {
    request(base.server)
        .post('/api/users')
        .send({
          name: 'Ig0r-R0xX0r',
          password: '1mN0tB0b',
          privilegePassword: '1mSt1llN0tB0b',
          email: 'igor@ok.net',
          role: 'citizen',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then(async (response) => {
          const body = response.body;

          assert.notEqual(body.id, base.adminId);
          assert.notEqual(body.id, base.citizenId);
          assert.equal(body.name, 'Ig0r-R0xX0r');
          assert.equal(body.email, 'igor@ok.net');
          assert.equal(body.role, 'citizen');

          await TypeORM.getConnection().manager.createQueryBuilder(User, 'user')
              .where('user.id = :uid', {uid: body.id}).getOne()
              .then((user) => {
                // Assert fields
                assert.equal(user.id, body.id);
                assert.equal(user.name, 'Ig0r-R0xX0r');
                assert.equal(user.password, db.hashPassword('1mN0tB0b', user.salt));
                assert.equal(user.privilegePassword, db.hashPassword('1mSt1llN0tB0b', user.salt));
                assert.equal(user.email, 'igor@ok.net');
                assert.equal(user.role, 'citizen');

                done();
              }).catch((err) => done(err));
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id (as admin) - Not Found', (done) => {
    request(base.server)
        .put('/api/users/66666')
        .send({
          role: 'tourist',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404).then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'invalidParamsId');
          assert.equal(body[0].ctx, 'params');
          assert.equal(body[0].field, 'id');

          done();
        }).catch((err) => done(err));
  });

  it('PUT /api/users/id (as admin to self) - Forbidden (change role)', (done) => {
    request(base.server)
        .put('/api/users/' + base.adminId)
        .send({
          role: 'citizen',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'staticBodyRole');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'role');

          done();
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id (as admin to other) - Bad Request (invalid role)', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          role: 'god',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'invalidBodyRole');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'role');

          done();
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id (as admin to other) - Bad Request (invalid format)', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          name: 1337,
          email: 'igor@ok.net',
          password: '1mN0tB0b',
          role: 'citizen',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'invalidBodyName');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'name');

          done();
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id (as admin to other) - Bad Request (passwords identical)', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          privilegePassword: '3p1cP4sSw0Rd', // same as account password
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'invalidBodyPrivilegePassword');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'privilegePassword');

          done();
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id (as admin to other) - Bad Request (name already taken)', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          name: 'xXx_B0b_xXx',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'nonUniqueBodyName');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'name');

          done();
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id (as admin to other) - Bad Request (email already taken)', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          email: 'test@somemail.com',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'nonUniqueBodyEmail');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'email');

          done();
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id (as admin to other) - Bad Request (invalid email)', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          email: 'Not an email address',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'invalidBodyEmail');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'email');

          done();
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id (as admin to other) - OK', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          name: 'Ig0r-R0xX0r',
          privilegePassword: '1mN0tB0b', // Only change privilege password
          email: 'igor@ok.net',
          role: 'tourist',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then(async (response) => {
          const body = response.body;

          assert.equal(body.id, base.citizenId);
          assert.equal(body.name, 'Ig0r-R0xX0r');
          assert.equal(body.email, 'igor@ok.net');
          assert.equal(body.role, 'tourist');

          await TypeORM.getConnection().manager.createQueryBuilder(User, 'user')
              .where('user.id = :uid', {uid: body.id}).getOne()
              .then((user) => {
                // Assert fields
                assert.equal(user.id, body.id);
                assert.equal(user.name, 'Ig0r-R0xX0r');
                assert.equal(user.password, db.hashPassword('3p1cP4sSw0Rd', user.salt));
                assert.equal(user.privilegePassword, db.hashPassword('1mN0tB0b', user.salt));
                assert.equal(user.email, 'igor@ok.net');
                assert.equal(user.role, 'tourist');

                done();
              }).catch((err) => done(err));
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id (as admin to self) - OK', (done) => {
    request(base.server)
        .put('/api/users/' + base.adminId)
        .send({
          name: 'Ig0r-R0xX0r',
          privilegePassword: null, // Remove privilege password
          email: 'igor@ok.net',
        })
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then(async (response) => {
          const body = response.body;

          assert.equal(body.id, base.adminId);
          assert.equal(body.name, 'Ig0r-R0xX0r');
          assert.equal(body.email, 'igor@ok.net');
          assert.equal(body.role, 'admin');

          await TypeORM.getConnection().manager.createQueryBuilder(User, 'user')
              .where('user.id = :uid', {uid: body.id}).getOne()
              .then((user) => {
                // Assert fields
                assert.equal(user.id, body.id);
                assert.equal(user.name, 'Ig0r-R0xX0r');
                assert.equal(user.password, db.hashPassword('3p1cP4sSw0Rd', user.salt));
                assert.equal(user.privilegePassword, null);
                assert.equal(user.email, 'igor@ok.net');
                assert.equal(user.role, 'admin');

                done();
              }).catch((err) => done(err));
        })
        .catch((err) => done(err));
  });

  it('DELETE /api/users/id (as admin) - OK (someone else)', (done) => {
    request(base.server)
        .delete('/api/users/' + base.citizenId)
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then(async (response) => {
          const body = response.body;

          assert.equal(body.id, base.citizenId);
          assert.equal(body.name, 'oOo_Al1ce_oOo');
          assert.equal(body.email, 'test2@somemail.com');
          assert.equal(body.role, 'citizen');

          // The user should have been removed from the DB
          await TypeORM.getConnection().manager.createQueryBuilder(User, 'user')
              .where('user.id = :uid', {uid: body.id}).getOne()
              .then((user) => {
                // Assert fields
                assert.equal(user, null);

                done();
              }).catch((err) => done(err));
        })
        .catch((err) => done(err));
  });

  it('DELETE /api/users/id (as admin) - Forbidden (self)', (done) => {
    request(base.server)
        .delete('/api/users/' + base.adminId)
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('DELETE /api/users/id (as admin) - Not Found', (done) => {
    request(base.server)
        .delete('/api/users/66666')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404).then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'invalidParamsId');
          assert.equal(body[0].ctx, 'params');
          assert.equal(body[0].field, 'id');

          done();
        }).catch((err) => done(err));
  });

  // Testing User API (as citizen)

  it('GET /api/users (as citizen) - Forbidden (low rank)', (done) => {
    request(base.server)
        .get('/api/users')
        .set('Authorization', 'Bearer ' + base.citizenBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('GET /api/users (as citizen) - Unauthorized', (done) => {
    request(base.server)
        .get('/api/users')
        .set('Authorization', 'gibberish')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401, done);
  });

  it('GET /api/users (as citizen) - Forbidden', (done) => {
    request(base.server)
        .get('/api/users')
        .set('Authorization', 'Bearer iNvAlId')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('GET /api/users/id (as citizen) - OK (self)', (done) => {
    request(base.server)
        .get('/api/users/' + base.citizenId)
        .set('Authorization', 'Bearer ' + base.citizenBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then((response) => {
          const body = response.body;

          assert.equal(body.id, base.citizenId);
          assert.equal(body.name, 'oOo_Al1ce_oOo');
          assert.equal(body.email, 'test2@somemail.com');
          assert.equal(body.role, 'citizen');

          done();
        })
        .catch((err) => done(err));
  });

  it('GET /api/users/id (as citizen) - Forbidden (someone else)', (done) => {
    request(base.server)
        .get('/api/users/' + base.adminId)
        .set('Authorization', 'Bearer ' + base.citizenBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('GET /api/users/id (as citizen) - Unauthorized', (done) => {
    request(base.server)
        .get('/api/users/' + base.citizenId)
        .set('Authorization', 'gibberish')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401, done);
  });

  it('GET /api/users/id (as citizen) - Forbidden', (done) => {
    request(base.server)
        .get('/api/users/' + base.citizenId)
        .set('Authorization', 'Bearer iNvAlId')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('POST /api/users (as citizen) - Forbidden (not admin)', (done) => {
    request(base.server)
        .post('/api/users')
        .send({
          name: 'Ig0r-R0xX0r',
          password: '1mN0tB0b',
          email: 'igor@ok.net',
          role: 'citizen',
        })
        .set('Authorization', 'Bearer ' + base.citizenBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('POST /api/users - Unauthorized', (done) => {
    request(base.server)
        .post('/api/users')
        .send({
          name: 'Ig0r-R0xX0r',
          password: '1mN0tB0b',
          email: 'igor@ok.net',
          role: 'citizen',
        })
        .set('Authorization', 'gibberish')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401, done);
  });

  it('POST /api/users - Forbidden', (done) => {
    request(base.server)
        .post('/api/users')
        .send({
          name: 'Ig0r-R0xX0r',
          password: '1mN0tB0b',
          email: 'igor@ok.net',
          role: 'citizen',
        })
        .set('Authorization', 'Bearer iNvAlId')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('PUT /api/users/id (as citizen to self) - Forbidden (change role)', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          role: 'admin',
        })
        .set('Authorization', 'Bearer ' + base.citizenBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'staticBodyRole');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'role');

          done();
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id (as citizen to self) - Bad Request (invalid format)', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          name: 1337,
          email: 'igor@ok.net',
          password: '1mN0tB0b',
        })
        .set('Authorization', 'Bearer ' + base.citizenBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'invalidBodyName');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'name');

          done();
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id (as citizen to self) - Bad Request (passwords identical)', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          privilegePassword: '3p1cP4sSw0Rd', // same as account password
        })
        .set('Authorization', 'Bearer ' + base.citizenBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'invalidBodyPrivilegePassword');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'privilegePassword');

          done();
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id (as citizen to self) - Bad Request (name already taken)', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          name: 'xXx_B0b_xXx',
        })
        .set('Authorization', 'Bearer ' + base.citizenBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'nonUniqueBodyName');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'name');

          done();
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id (as citizen to self) - Bad Request (email already taken)', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          email: 'test@somemail.com',
        })
        .set('Authorization', 'Bearer ' + base.citizenBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'nonUniqueBodyEmail');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'email');

          done();
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id (as citizen to self) - Bad Request (invalid email)', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          email: 'Not an email address',
        })
        .set('Authorization', 'Bearer ' + base.citizenBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          const body = response.body;

          // We expect only one entry
          assert.equal(body.length, 1);

          assert.equal(body[0].name, 'invalidBodyEmail');
          assert.equal(body[0].ctx, 'body');
          assert.equal(body[0].field, 'email');

          done();
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id (as citizen to other) - Forbidden', (done) => {
    request(base.server)
        .put('/api/users/' + base.adminId)
        .send({
          name: 'Ig0r-R0xX0r',
          privilegePassword: '1mN0tB0b', // Only change privilege password
          email: 'igor@ok.net',
          role: 'tourist',
        })
        .set('Authorization', 'Bearer ' + base.citizenBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('PUT /api/users/id (as citizen to self) - OK', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          name: 'Ig0r-R0xX0r',
          privilegePassword: null, // Remove privilege password
          email: 'igor@ok.net',
        })
        .set('Authorization', 'Bearer ' + base.citizenBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then(async (response) => {
          const body = response.body;

          assert.equal(body.id, base.citizenId);
          assert.equal(body.name, 'Ig0r-R0xX0r');
          assert.equal(body.email, 'igor@ok.net');
          assert.equal(body.role, 'citizen');

          await TypeORM.getConnection().manager.createQueryBuilder(User, 'user')
              .where('user.id = :uid', {uid: body.id}).getOne()
              .then((user) => {
                // Assert fields
                assert.equal(user.id, body.id);
                assert.equal(user.name, 'Ig0r-R0xX0r');
                assert.equal(user.password, db.hashPassword('3p1cP4sSw0Rd', user.salt));
                assert.equal(user.privilegePassword, null);
                assert.equal(user.email, 'igor@ok.net');
                assert.equal(user.role, 'citizen');

                done();
              }).catch((err) => done(err));
        })
        .catch((err) => done(err));
  });

  it('PUT /api/users/id - Forbidden', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          email: 'igor@ok.net',
        })
        .set('Authorization', 'Bearer iNvAlId')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('PUT /api/users/id - Unauthorized', (done) => {
    request(base.server)
        .put('/api/users/' + base.citizenId)
        .send({
          email: 'igor@ok.net',
        })
        .set('Authorization', 'gibberish')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401, done);
  });

  it('DELETE /api/users/id (as admin) - OK (someone else)', (done) => {
    request(base.server)
        .delete('/api/users/' + base.citizenId)
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then(async (response) => {
          const body = response.body;

          assert.equal(body.id, base.citizenId);
          assert.equal(body.name, 'oOo_Al1ce_oOo');
          assert.equal(body.email, 'test2@somemail.com');
          assert.equal(body.role, 'citizen');

          // The user should have been removed from the DB
          await TypeORM.getConnection().manager.createQueryBuilder(User, 'user')
              .where('user.id = :uid', {uid: body.id}).getOne()
              .then((user) => {
                // Assert fields
                assert.equal(user, null);

                done();
              }).catch((err) => done(err));
        })
        .catch((err) => done(err));
  });

  it('DELETE /api/users/id (as citizen) - Forbidden (self)', (done) => {
    request(base.server)
        .delete('/api/users/' + base.citizenId)
        .set('Authorization', 'Bearer ' + base.citizenBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('DELETE /api/users/id (as citizen) - Forbidden (someone else)', (done) => {
    request(base.server)
        .delete('/api/users/' + base.adminId)
        .set('Authorization', 'Bearer ' + base.citizenBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('DELETE /api/users/id - Forbidden', (done) => {
    request(base.server)
        .delete('/api/users/' + base.citizenId)
        .set('Authorization', 'Bearer iNvAlId')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('DELETE /api/users/id - Unauthorized', (done) => {
    request(base.server)
        .delete('/api/users/' + base.citizenId)
        .set('Authorization', 'gibberish')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401, done);
  });
});
