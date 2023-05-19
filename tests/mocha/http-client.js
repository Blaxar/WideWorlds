/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import makeHttpTestBase from '../utils.js';
import HttpClient from '../../client/src/core/http-client.js';
import {defaultPageDiameter, unpackElevationData}
  from '../../common/terrain-utils.js';
import * as assert from 'assert';

// Testing http client
describe('http client', () => {
  const ctx = makeHttpTestBase();
  const base = ctx.base;

  const httpClient = new HttpClient('http://127.0.0.1:' + base.port + '/api', true);

  before(ctx.before);

  beforeEach(ctx.beforeEach);

  afterEach(async () => {
    await ctx.afterEach();
    httpClient.clear();
  });

  after(ctx.after);

  const login = async () => await httpClient.login('xXx_B0b_xXx', '3p1cP4sSw0Rd');

  it('login - OK', (done) => {
    login().then(() => done())
        .catch((err) => done(err));
  });

  it('login - Unauthorized', (done) => {
    httpClient.login('xXx_B0b_xXx', 'UwU')
        .then(() => done('Login should not work here'))
        .catch((err) => {
          if (err.message == 401) done();
          else done(err);
        });
  });

  // Testing World API

  it('getWorlds - OK', (done) => {
    login().then(() => {
      httpClient.getWorlds()
          .then((body) => {
            // We expect only one entry
            assert.equal(body.length, 1);

            assert.equal(body[0].id, base.worldId);
            assert.equal(body[0].name, 'Test World');
            assert.equal(body[0].data, '{}');

            done();
          });
    })
        .catch((err) => done(err));
  });

  it('getWorlds - Unauthorized', (done) => {
    httpClient.getWorlds()
        .then(() => done('Getting worlds should not work here'))
        .catch((err) => {
          if (err.message == 401) done();
          else done(err);
        });
  });

  // Testing Props API

  it('getProps - OK (all)', (done) => {
    login().then(() => {
      httpClient.getProps(
        base.worldId,
        -10000, 10000,
        -10000, 10000,
        -10000, 10000
      ).then((body) => {
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
      });
    }).catch((err) => done(err));
  });

  it('getProps - OK (none)', (done) => {
    login().then(() => {
      httpClient.getProps(
        base.worldId,
        20000, 30000,
        20000, 30000,
        20000, 30000
      ).then((body) => {
        // We expect no entry
        assert.equal(body.length, 0);

        done();
      });
    }).catch((err) => done(err));
  });

  it('getProps - Not found', (done) => {
    login().then(() => {
      httpClient.getProps(
        base.worldId + 3000,
      ).then(() => done('Getting props should not work here'))
        .catch((err) => {
          if (err.message == 404) done();
          else done(err);
        });
    });
  });

  it('getProps - Unauthorized', (done) => {
    httpClient.getProps(
      base.worldId,
    ).then(() => done('Getting props should not work here'))
      .catch((err) => {
        if (err.message == 401) done();
        else done(err);
      });
  });

  // Testing Page API

  it('getPage - OK', (done) => {
    login().then(() => {
      httpClient.getPage(base.worldId, 0, 0)
        .then((body) => {
          assert.strictEqual(body.elevationData.length,
              defaultPageDiameter * defaultPageDiameter);
          assert.strictEqual(body.textureData.length,
              defaultPageDiameter * defaultPageDiameter);

          done();
        });
    }).catch((err) => done(err));
  });

  it('getPage - Not found', (done) => {
    login().then(() => {
      httpClient.getPage(
        base.worldId + 3000,
      ).then(() => done('Getting props should not work here'))
        .catch((err) => {
          if (err.message == 404) done();
          else done(err);
        });
    });
  });

  it('getPage - Unauthorized', (done) => {
    httpClient.getPage(
      base.worldId,
    ).then(() => done('Getting props should not work here'))
      .catch((err) => {
        if (err.message == 401) done();
        else done(err);
      });
  });
});
