/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import Prop from '../../common/db/model/Prop.js';
import makeHttpTestBase, {epsEqual} from '../utils.js';
import TypeORM from 'typeorm';
import request from 'superwstest';
import * as assert from 'assert';

// Testing http server

describe('http server props', () => {
  const ctx = makeHttpTestBase();
  const base = ctx.base;

  before(ctx.before);

  beforeEach(ctx.beforeEach);

  afterEach(ctx.afterEach);

  after(ctx.after);

  // Testing GET Prop API

  it('GET /api/worlds/id/props - OK', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then((response) => {
          // Get the body (json content) of the request
          const body = response.body;

          // We expect two entries
          assert.equal(body.length, 2);

          // Assert first prop fields
          assert.equal(body[0].worldId, base.worldId);
          assert.equal(body[0].userId, base.adminId);
          assert.equal(body[0].date, base.now);
          assert.equal(body[0].x, 0);
          assert.equal(body[0].y, 0);
          assert.equal(body[0].z, 0);
          assert.equal(body[0].yaw, 0);
          assert.equal(body[0].pitch, 0);
          assert.equal(body[0].roll, 0);
          assert.equal(body[0].name, 'wall01.rwx');
          assert.equal(body[0].description, 'Some description.');
          assert.equal(body[0].action, 'create color red;');

          // Assert second prop fields
          assert.equal(body[1].worldId, base.worldId);
          assert.equal(body[1].userId, base.adminId);
          assert.equal(body[1].date, base.now);
          assert.equal(body[1].x, 100);
          assert.equal(body[1].y, -200);
          assert.equal(body[1].z, 300);
          assert.equal(body[1].yaw, 450);
          assert.equal(body[1].pitch, 900);
          assert.equal(body[1].roll, 1350);
          assert.equal(body[1].name, 'wall02.rwx');
          assert.equal(body[1].description, 'Some other description.');
          assert.equal(body[1].action, 'create color blue;');

          done();
        })
        .catch((err) => done(err));
  });

  it('GET /api/worlds/id/props with filters - OK', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId + '/props?minX=50&maxX=150&minY=-240&maxY=-160&minZ=270&maxZ=330')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200).then((response) => {
          // Get the body (json content) of the request
          const body = response.body;

          // We expect one single entry
          assert.equal(body.length, 1);

          // Assert prop fields
          assert.equal(body[0].worldId, base.worldId);
          assert.equal(body[0].userId, base.adminId);
          assert.equal(body[0].date, base.now);
          assert.equal(body[0].x, 100);
          assert.equal(body[0].y, -200);
          assert.equal(body[0].z, 300);
          assert.equal(body[0].yaw, 450);
          assert.equal(body[0].pitch, 900);
          assert.equal(body[0].roll, 1350);
          assert.equal(body[0].name, 'wall02.rwx');
          assert.equal(body[0].description, 'Some other description.');
          assert.equal(body[0].action, 'create color blue;');

          done();
        })
        .catch((err) => done(err));
  });

  it('GET /api/worlds/id/props with filters - Bad Request', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId + '/props?minX=sdgdsgsdg&maxX=150&minY=-240&maxY=-160&minZ=270&maxZ=330')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400, done);
  });

  it('GET /api/worlds/id/props - Unauthorized', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'gibberish')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401, done);
  });

  it('GET /api/worlds/id/props - Forbidden', (done) => {
    request(base.server)
        .get('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'Bearer iNvAlId')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('GET /api/worlds/id/props - Not found', (done) => {
    request(base.server)
        .get('/api/worlds/66666/props')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404, done);
  });

  // Testing PUT Prop API

  it('PUT /api/worlds/id/props - OK', (done) => {
    const unknownPropId = 66666;

    // Ready payload
    const payload = {};

    payload[base.firstPropId] = {
      x: 1.23,
      y: -4.56,
      z: 0.2,
      yaw: 3.141592,
      pitch: -2.0,
      roll: 5.2,
    };

    payload[base.secondPropId] = {
      name: 'door02.rwx',
      description: 'Some renewed description.',
      action: 'create color green;',
    };

    payload[unknownPropId] = {
      name: 'door03.rwx',
      description: 'Some description',
    };

    const propsUpdateCb = (actual) => {
      const data = JSON.parse(actual);
      assert.equal(data.op, 'update');

      const props = data.data;
      assert.equal(props.length, 2);

      // Assert first prop fields
      assert.equal(props[0].id, base.firstPropId);
      assert.equal(props[0].worldId, base.worldId);
      assert.equal(props[0].userId, base.adminId);
      assert.ok(epsEqual(props[0].x, 1.23));
      assert.ok(epsEqual(props[0].y, -4.56));
      assert.ok(epsEqual(props[0].z, 0.2));
      assert.ok(epsEqual(props[0].yaw, 3.141592));
      assert.ok(epsEqual(props[0].pitch, -2.0));
      assert.ok(epsEqual(props[0].roll, 5.2));
      assert.equal(props[0].name, 'wall01.rwx');
      assert.equal(props[0].description, 'Some description.');
      assert.equal(props[0].action, 'create color red;');

      // Assert second prop fields
      assert.strictEqual(props[1].id, base.secondPropId);
      assert.equal(props[1].worldId, base.worldId);
      assert.equal(props[1].userId, base.adminId);
      assert.equal(props[1].x, 100);
      assert.equal(props[1].y, -200);
      assert.equal(props[1].z, 300);
      assert.equal(props[1].yaw, 450);
      assert.equal(props[1].pitch, 900);
      assert.equal(props[1].roll, 1350);
      assert.equal(props[1].name, 'door02.rwx');
      assert.equal(props[1].description, 'Some renewed description.');
      assert.equal(props[1].action, 'create color green;');
    };

    Promise.all([
      // Ready the bare Websocket client API, we should be notified of the props update from there
      request(base.server).ws('/api/worlds/' + base.worldId + '/ws/update?token=' + base.citizenBearerToken)
          .expectText(propsUpdateCb)
          .close()
          .expectClosed(),
      // Processing the PUT request should take a few ms, the websocket connection will have surely
      // been established by then
      request(base.server)
        .put('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(200).then(async (response) => {
          // Get the body (json content) of the request
          const body = response.body;

          // We expect three entries
          assert.equal(Object.entries(body).length, 3);

          // Assert first prop status
          assert.strictEqual(body[base.firstPropId], true);

          // Assert second prop status
          assert.strictEqual(body[base.secondPropId], true);

          // Assert unknown prop status
          assert.strictEqual(body[unknownPropId], null);

          await TypeORM.getConnection().manager.createQueryBuilder(Prop, 'prop')
              .where('prop.worldId = :wid', {wid: base.worldId}).getMany()
              .then((props) => {
                // We expect two entries
                assert.equal(props.length, 2);

                // Assert first prop fields
                assert.equal(props[0].id, base.firstPropId);
                assert.equal(props[0].worldId, base.worldId);
                assert.equal(props[0].userId, base.adminId);
                assert.ok(epsEqual(props[0].x, 1.23));
                assert.ok(epsEqual(props[0].y, -4.56));
                assert.ok(epsEqual(props[0].z, 0.2));
                assert.ok(epsEqual(props[0].yaw, 3.141592));
                assert.ok(epsEqual(props[0].pitch, -2.0));
                assert.ok(epsEqual(props[0].roll, 5.2));
                assert.equal(props[0].name, 'wall01.rwx');
                assert.equal(props[0].description, 'Some description.');
                assert.equal(props[0].action, 'create color red;');

                // Assert second prop fields
                assert.strictEqual(props[1].id, base.secondPropId);
                assert.equal(props[1].worldId, base.worldId);
                assert.equal(props[1].userId, base.adminId);
                assert.equal(props[1].x, 100);
                assert.equal(props[1].y, -200);
                assert.equal(props[1].z, 300);
                assert.equal(props[1].yaw, 450);
                assert.equal(props[1].pitch, 900);
                assert.equal(props[1].roll, 1350);
                assert.equal(props[1].name, 'door02.rwx');
                assert.equal(props[1].description, 'Some renewed description.');
                assert.equal(props[1].action, 'create color green;');
              });
        })
    ]).then(() => done()).catch((err) => done(err));
  });

  it('PUT /api/worlds/id/props - Bad request', (done) => {
    const payload = {1: 'not an object'};

    request(base.server)
        .put('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(400, done);
    });

  it('PUT /api/worlds/id/props - Unauthorized', (done) => {
    // Ready payload
    const payload = {};

    payload[base.firstPropId] = {
      x: 1.23,
      y: -4.56,
      z: 0.2,
      yaw: 3.141592,
      pitch: -2.0,
      roll: 5.2,
    };

    request(base.server)
        .put('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'gibberish')
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(401, done);
  });

  it('PUT /api/worlds/id/props - Forbidden', (done) => {
    // Ready payload
    const payload = {};

    payload[base.firstPropId] = {
      x: 1.23,
      y: -4.56,
      z: 0.2,
      yaw: 3.141592,
      pitch: -2.0,
      roll: 5.2,
    };

    request(base.server)
        .put('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'Bearer iNvAlId')
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('PUT /api/worlds/id/props - Not found', (done) => {
    // Ready payload
    const payload = {};

    payload[base.firstPropId] = {
      x: 1.23,
      y: -4.56,
      z: 0.2,
      yaw: 3.141592,
      pitch: -2.0,
      roll: 5.2,
    };

    request(base.server)
        .put('/api/worlds/77777/props')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(404, done);
  });

  // Testing POST Prop API

  it('POST /api/worlds/id/props - OK', (done) => {
    // Ready payload
    const payload = [
      {
        x: 1.23,
        y: -4.56,
        z: 0.2,
        yaw: 3.141592,
        pitch: -2.0,
        roll: 5.2,
        name: 'wall01.rwx',
        description: 'Some description.',
        action: 'create color red;',
      },
      {
        x: 100,
        y: -200,
        z: 300,
        yaw: 450,
        pitch: 900,
        roll: 1350,
        name: 'door02.rwx',
        description: 'Some renewed description.',
        action: 'create color green;',
      },
      {
        name: 'door03.rwx',
        description: 'Some description',
      }
    ];

    const propsCreateCb = (actual) => {
      const data = JSON.parse(actual);
      assert.equal(data.op, 'create');

      const props = data.data;
      assert.equal(props.length, 2);

      // Assert first prop fields
      assert.notEqual(props[0].id, base.firstPropId);
      assert.notEqual(props[0].id, base.secondPropId);
      assert.notEqual(props[0].id, props[1].id);
      assert.equal(props[0].worldId, base.worldId);
      assert.equal(props[0].userId, base.adminId);
      assert.ok(epsEqual(props[0].x, 1.23));
      assert.ok(epsEqual(props[0].y, -4.56));
      assert.ok(epsEqual(props[0].z, 0.2));
      assert.ok(epsEqual(props[0].yaw, 3.141592));
      assert.ok(epsEqual(props[0].pitch, -2.0));
      assert.ok(epsEqual(props[0].roll, 5.2));
      assert.equal(props[0].name, 'wall01.rwx');
      assert.equal(props[0].description, 'Some description.');
      assert.equal(props[0].action, 'create color red;');

      // Assert second prop fields
      assert.notEqual(props[1].id, base.firstPropId);
      assert.notEqual(props[1].id, base.secondPropId);
      assert.notEqual(props[1].id, props[0].id);
      assert.equal(props[1].worldId, base.worldId);
      assert.equal(props[1].userId, base.adminId);
      assert.equal(props[1].x, 100);
      assert.equal(props[1].y, -200);
      assert.equal(props[1].z, 300);
      assert.equal(props[1].yaw, 450);
      assert.equal(props[1].pitch, 900);
      assert.equal(props[1].roll, 1350);
      assert.equal(props[1].name, 'door02.rwx');
      assert.equal(props[1].description, 'Some renewed description.');
      assert.equal(props[1].action, 'create color green;');
    };

    Promise.all([
      // Ready the bare Websocket client API, we should be notified of the props creation from there
      request(base.server).ws('/api/worlds/' + base.worldId + '/ws/update?token=' + base.citizenBearerToken)
          .expectText(propsCreateCb)
          .close()
          .expectClosed(),
      // Processing the PUT request should take a few ms, the websocket connection will have surely
      // been established by then
      request(base.server)
        .post('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(200).then(async (response) => {
          // Get the body (json content) of the request
          const body = response.body;

          // We expect three entries
          assert.equal(body.length, 3);

          // Assert first prop status
          assert.strictEqual(body[0], true);

          // Assert second prop status
          assert.strictEqual(body[1], true);

          // Assert unknown prop status
          assert.strictEqual(body[2], null);

          await TypeORM.getConnection().manager.createQueryBuilder(Prop, 'prop')
              .where('prop.worldId = :wid', {wid: base.worldId}).getMany()
              .then((props) => {
                // We expect four entries: the two existing ones and
                // the 2 new ones
                assert.equal(props.length, 4);

                // Assert third prop fields
                assert.notEqual(props[2].id, base.firstPropId);
                assert.notEqual(props[2].id, base.secondPropId);
                assert.notEqual(props[2].id, props[3].id);
                assert.ok(epsEqual(props[2].x, 1.23));
                assert.ok(epsEqual(props[2].y, -4.56));
                assert.ok(epsEqual(props[2].z, 0.2));
                assert.ok(epsEqual(props[2].yaw, 3.141592));
                assert.ok(epsEqual(props[2].pitch, -2.0));
                assert.ok(epsEqual(props[2].roll, 5.2));
                assert.equal(props[2].name, 'wall01.rwx');
                assert.equal(props[2].description, 'Some description.');
                assert.equal(props[2].action, 'create color red;');

                // Assert fourth prop fields
                assert.notEqual(props[3].id, base.firstPropId);
                assert.notEqual(props[3].id, base.secondPropId);
                assert.notEqual(props[3].id, props[2].id);
                assert.equal(props[3].worldId, base.worldId);
                assert.equal(props[3].userId, base.adminId);
                assert.equal(props[3].x, 100);
                assert.equal(props[3].y, -200);
                assert.equal(props[3].z, 300);
                assert.equal(props[3].yaw, 450);
                assert.equal(props[3].pitch, 900);
                assert.equal(props[3].roll, 1350);
                assert.equal(props[3].name, 'door02.rwx');
                assert.equal(props[3].description, 'Some renewed description.');
                assert.equal(props[3].action, 'create color green;');
              });
        })
    ]).then(() => done()).catch((err) => done(err));
  });

  it('POST /api/worlds/id/props - Bad request', (done) => {
    const payload = ['not an object'];

    request(base.server)
        .post('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(400, done);
    });

  it('POST /api/worlds/id/props - Unauthorized', (done) => {
    // Ready payload
    const payload = [
      {
        x: 1.23,
        y: -4.56,
        z: 0.2,
        yaw: 3.141592,
        pitch: -2.0,
        roll: 5.2,
        name: 'wall01.rwx',
        description: 'Some description.',
        action: 'create color red;',
      },
    ];

    request(base.server)
        .post('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'gibberish')
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(401, done);
  });

  it('POST /api/worlds/id/props - Forbidden', (done) => {
    // Ready payload
    const payload = [
      {
        x: 1.23,
        y: -4.56,
        z: 0.2,
        yaw: 3.141592,
        pitch: -2.0,
        roll: 5.2,
        name: 'wall01.rwx',
        description: 'Some description.',
        action: 'create color red;',
      },
    ];

    request(base.server)
        .post('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'Bearer iNvAlId')
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('POST /api/worlds/id/props - Not found', (done) => {
    // Ready payload
    const payload = [
      {
        x: 1.23,
        y: -4.56,
        z: 0.2,
        yaw: 3.141592,
        pitch: -2.0,
        roll: 5.2,
        name: 'wall01.rwx',
        description: 'Some description.',
        action: 'create color red;',
      },
    ];

    request(base.server)
        .post('/api/worlds/77777/props')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(404, done);
  });

  // Testing DELETE Prop API

  it('DELETE /api/worlds/id/props - OK', (done) => {
    // Ready payload
    const payload = [base.firstPropId, base.secondPropId, 66666];

    const propsDeleteCb = (actual) => {
      const data = JSON.parse(actual);
      assert.equal(data.op, 'delete');

      const props = data.data;
      assert.equal(props.length, 2);

      // Assert first prop ID
      assert.strictEqual(props[0], base.firstPropId);

      // Assert second prop ID
      assert.strictEqual(props[1], base.secondPropId);
    };

    Promise.all([
      // Ready the bare Websocket client API, we should be notified of the props deletion from there
      request(base.server).ws('/api/worlds/' + base.worldId + '/ws/update?token=' + base.citizenBearerToken)
          .expectText(propsDeleteCb)
          .close()
          .expectClosed(),
      // Processing the DELETE request should take a few ms, the websocket connection will have surely
      // been established by then
      request(base.server)
        .delete('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(200).then(async (response) => {
          // Get the body (json content) of the request
          const body = response.body;

          // We expect three entries
          assert.equal(body.length, 3);

          // Assert first prop status
          assert.strictEqual(body[0], true);

          // Assert second prop status
          assert.strictEqual(body[1], true);

          // Assert unknown prop status
          assert.strictEqual(body[2], null);

          await TypeORM.getConnection().manager.createQueryBuilder(Prop, 'prop')
              .where('prop.worldId = :wid', {wid: base.worldId}).getMany()
              .then((props) => {
                // We expect no entries has all should have been deleted
                assert.equal(props.length, 0);
              });
        })
    ]).then(() => done()).catch((err) => done(err));
  });

  it('DELETE /api/worlds/id/props - Bad request', (done) => {
    const payload = ['not an integer'];

    request(base.server)
        .delete('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(400, done);
    });

  it('DELETE /api/worlds/id/props - Duplicated IDs', (done) => {
    const payload = [base.firstPropId, base.firstPropId];

    request(base.server)
        .delete('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(400, done);
    });

  it('DELETE /api/worlds/id/props - Unauthorized', (done) => {
    // Ready payload
    const payload = [base.firstPropId, base.secondPropId, 66666];

    request(base.server)
        .delete('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'gibberish')
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(401, done);
  });

  it('DELETE /api/worlds/id/props - Forbidden', (done) => {
    // Ready payload
    const payload = [base.firstPropId, base.secondPropId, 66666];

    request(base.server)
        .delete('/api/worlds/' + base.worldId + '/props')
        .set('Authorization', 'Bearer iNvAlId')
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(403, done);
  });

  it('DELETE /api/worlds/id/props - Not found', (done) => {
    // Ready payload
    const payload = [base.firstPropId, base.secondPropId, 66666];

    request(base.server)
        .delete('/api/worlds/77777/props')
        .set('Authorization', 'Bearer ' + base.adminBearerToken)
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(404, done);
  });
});
