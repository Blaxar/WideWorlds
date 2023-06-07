/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import Prop from '../../common/db/model/Prop.js';
import makeHttpTestBase from '../utils.js';
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

  // Testing Prop API

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

  it('PUT /api/worlds/id/props - OK', (done) => {
    const unknownPropId = 66666;

    // Ready payload
    const payload = {};

    payload[base.firstPropId] = {
      name: 'door01.rwx',
      description: "Some new description.",
    };

    payload[base.secondPropId] = {
      name: 'door02.rwx',
      description: "Some renewed description.",
    };

    payload[unknownPropId] = {
      name: 'door03.rwx',
      description: "Some description",
    };

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

                assert.strictEqual(props[0].id, base.firstPropId);

                // Assert first prop fields
                assert.equal(props[0].worldId, base.worldId);
                assert.equal(props[0].userId, base.adminId);
                assert.equal(props[0].x, 0);
                assert.equal(props[0].y, 0);
                assert.equal(props[0].z, 0);
                assert.equal(props[0].yaw, 0);
                assert.equal(props[0].pitch, 0);
                assert.equal(props[0].roll, 0);
                assert.equal(props[0].name, 'door01.rwx');
                assert.equal(props[0].description, 'Some new description.');
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
                assert.equal(props[1].action, 'create color blue;');
            });
          done();
        })
        .catch((err) => done(err));
  });
});
