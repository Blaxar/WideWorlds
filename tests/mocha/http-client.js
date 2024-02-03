/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import makeHttpTestBase, {epsEqual} from '../utils.js';
import HttpClient from '../../client/src/core/http-client.js';
import WsClient from '../../client/src/core/ws-client.js';
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

  it('putProps - OK', (done) => {
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
      description: "Some renewed description.",
      action: 'create color green;',
    };

    payload[unknownPropId] = {
      name: 'door03.rwx',
      description: "Some description",
    };

    const propsUpdateCb = (actual) => {
      const data = actual;
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

    const adminClient = new WsClient(`ws://127.0.0.1:${base.port}/api`, base.adminBearerToken);

    Promise.all([
      // Test the ws-client, we should be notified of the props update from there
      adminClient.worldUpdateConnect(base.worldId).then(
        (wu) => new Promise((resolve, reject) => {
            wu.onMessage((data) => {
              try {
                propsUpdateCb(data);
                wu.close();
              } catch (e) {
                reject(e);
              }
              resolve();
            });
          })
        ),
      // Processing the PUT request should take a few ms, the websocket connection will have surely
      // been established by then
      login().then(async () => {
        await httpClient.putProps(
          base.worldId,
          payload,
        ).then((body) => {
          // We expect three entries
          assert.equal(Object.entries(body).length, 3);

          // Assert first prop status
          assert.strictEqual(body[base.firstPropId], true);

          // Assert second prop status
          assert.strictEqual(body[base.secondPropId], true);

          // Assert unknown prop status
          assert.strictEqual(body[unknownPropId], null);
        });
      })
    ]).then(() => done()).catch((err) => done(err));
  });

  it('putProps - Not found', (done) => {
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
      description: "Some renewed description.",
      action: 'create color green;',
    };

    payload[unknownPropId] = {
      name: 'door03.rwx',
      description: "Some description",
    };

    login().then(() => {
      httpClient.putProps(
        base.worldId + 3000,
        payload,
      ).then(() => done('Updating props should not work here'))
        .catch((err) => {
          if (err.message == 404) done();
          else done(err);
        });
    });
  });

  it('putProps - Unauthorized', (done) => {
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
      description: "Some renewed description.",
      action: 'create color green;',
    };

    payload[unknownPropId] = {
      name: 'door03.rwx',
      description: "Some description",
    };

    httpClient.putProps(
      base.worldId,
      payload,
    ).then(() => done('Updating props should not work here'))
      .catch((err) => {
        if (err.message == 401) done();
        else done(err);
      });
  });

  it('postProps - OK', (done) => {
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
      const data = actual;
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

    const adminClient = new WsClient(`ws://127.0.0.1:${base.port}/api`, base.adminBearerToken);

    Promise.all([
      // Test the ws-client, we should be notified of the props creation from there
      adminClient.worldUpdateConnect(base.worldId).then(
        (wu) => new Promise((resolve, reject) => {
            wu.onMessage((data) => {
              try {
                propsCreateCb(data);
                wu.close();
              } catch (e) {
                reject(e);
              }
              resolve();
            });
          })
        ),
      // Processing the POST request should take a few ms, the websocket connection will have surely
      // been established by then
      login().then(async () => {
        await httpClient.postProps(
          base.worldId,
          payload,
        ).then((body) => {
          // We expect three entries
          assert.equal(body.length, 3);

          // Assert first prop status
          assert.strictEqual(body[0], true);

          // Assert second prop status
          assert.strictEqual(body[1], true);

          // Assert unknown prop status
          assert.strictEqual(body[2], null);
        });
      })
    ]).then(() => done()).catch((err) => done(err));
  });

  it('postProps - Not found', (done) => {
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

    login().then(() => {
      httpClient.postProps(
        base.worldId + 3000,
        payload,
      ).then(() => done('Creating props should not work here'))
        .catch((err) => {
          if (err.message == 404) done();
          else done(err);
        });
    });
  });

  it('postProps - Unauthorized', (done) => {
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

    httpClient.postProps(
      base.worldId,
      payload,
    ).then(() => done('Creating props should not work here'))
      .catch((err) => {
        if (err.message == 401) done();
        else done(err);
      });
  });

  it('deleteProps - OK', (done) => {
    // Ready payload
    const payload = [base.firstPropId, base.secondPropId, 66666];

    const propsDeleteCb = (actual) => {
      const data = actual;
      assert.equal(data.op, 'delete');

      const props = data.data;
      assert.equal(props.length, 2);

      // Assert first prop ID
      assert.strictEqual(props[0], base.firstPropId);

      // Assert second prop ID
      assert.strictEqual(props[1], base.secondPropId);
    };

    const adminClient = new WsClient(`ws://127.0.0.1:${base.port}/api`, base.adminBearerToken);

    Promise.all([
      // Test the ws-client, we should be notified of the props deletion from there
      adminClient.worldUpdateConnect(base.worldId).then(
        (wu) => new Promise((resolve, reject) => {
            wu.onMessage((data) => {
              try {
                propsDeleteCb(data);
                wu.close();
              } catch (e) {
                reject(e);
              }
              resolve();
            });
          })
        ),
      // Processing the DELETE request should take a few ms, the websocket connection will have surely
      // been established by then
      login().then(async () => {
        await httpClient.deleteProps(
          base.worldId,
          payload,
        ).then((body) => {
          // We expect three entries
          assert.equal(body.length, 3);

          // Assert first prop status
          assert.strictEqual(body[0], true);

          // Assert second prop status
          assert.strictEqual(body[1], true);

          // Assert unknown prop status
          assert.strictEqual(body[2], null);
        });
      })
    ]).then(() => done()).catch((err) => done(err));
  });

  it('deleteProps - Not found', (done) => {
    // Ready payload
    const payload = [base.firstPropId, base.secondPropId, 66666];

    login().then(() => {
      httpClient.deleteProps(
        base.worldId + 3000,
        payload,
      ).then(() => done('Creating props should not work here'))
        .catch((err) => {
          if (err.message == 404) done();
          else done(err);
        });
    });
  });

  it('deleteProps - Unauthorized', (done) => {
    // Ready payload
    const payload = [base.firstPropId, base.secondPropId, 66666];

    httpClient.deleteProps(
      base.worldId,
      payload,
    ).then(() => done('Creating props should not work here'))
      .catch((err) => {
        if (err.message == 401) done();
        else done(err);
      });
  });

  // Testing Terrain Page API

  it('getTerrainPage - OK', (done) => {
    login().then(() => {
      httpClient.getTerrainPage(base.worldId, 0, 0)
        .then((body) => {
          assert.strictEqual(body.elevationData.length,
              defaultPageDiameter * defaultPageDiameter);
          assert.strictEqual(body.textureData.length,
              defaultPageDiameter * defaultPageDiameter);

          done();
        });
    }).catch((err) => done(err));
  });

  it('getTerrainPage - Not found', (done) => {
    login().then(() => {
      httpClient.getTerrainPage(
        base.worldId + 3000,
      ).then(() => done('Getting page should not work here'))
        .catch((err) => {
          if (err.message == 404) done();
          else done(err);
        });
    });
  });

  it('getTerrainPage - Unauthorized', (done) => {
    httpClient.getTerrainPage(
      base.worldId,
    ).then(() => done('Getting page should not work here'))
      .catch((err) => {
        if (err.message == 401) done();
        else done(err);
      });
  });

  // Testing Water Page API

  it('getWaterPage - OK', (done) => {
    login().then(() => {
      httpClient.getWaterPage(base.worldId, 0, 0)
        .then((body) => {
          assert.strictEqual(body.length,
              defaultPageDiameter * defaultPageDiameter);

          done();
        });
    }).catch((err) => done(err));
  });

  it('getWaterPage - Not found', (done) => {
    login().then(() => {
      httpClient.getWaterPage(
        base.worldId + 3000,
      ).then(() => done('Getting page should not work here'))
        .catch((err) => {
          if (err.message == 404) done();
          else done(err);
        });
    });
  });

  it('getWaterPage - Unauthorized', (done) => {
    httpClient.getWaterPage(
      base.worldId,
    ).then(() => done('Getting page should not work here'))
      .catch((err) => {
        if (err.message == 401) done();
        else done(err);
      });
  });
});
