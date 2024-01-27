/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {defaultPageDiameter} from '../../common/terrain-utils.js';
import makeHttpTestBase from '../utils.js';
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

  it('GET /api/worlds/id - Not found', (done) => {
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

  it('GET /api/worlds/id/terrain/x/z/elevation - Not found', (done) => {
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

  it('GET /api/worlds/id/terrain/x/z/texture - Not found', (done) => {
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

  it('GET /api/worlds/id/water/x/z - Not found', (done) => {
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

  it('GET /api/users/id (as admin) - Not found', (done) => {
    request(base.server)
        .get('/api/users/66666')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404, done);
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
});
