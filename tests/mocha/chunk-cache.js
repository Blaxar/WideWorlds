/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import * as assert from 'assert';
import Prop from '../../common/db/model/Prop.js';
import {hashProps} from '../../common/props-data-format.js';
import {epsEqual} from '../utils.js';
import ChunkCache from '../../client/src/core/chunk-cache.js';
import "fake-indexeddb/auto";

const dummyMakeProp = (offset = 0) => {
  const id = 1337 + offset;
  const worldId = 42 + offset;
  const userId = 666 + offset;
  const date = 1721471167013 + offset;
  const x = 25.2 + offset;
  const y = 30.25 + offset;
  const z = -12.0 + offset;
  const yaw = 3.1415 + offset;
  const pitch = 1.2 + offset;
  const roll = 2.5 + offset;
  const name = `door0${offset}.rwx`;
  const description = `Welcome! Here we pay using ${offset}€`;
  const action = `create solid off; create name ${offset}`;

  return new Prop(id, worldId, userId, date, x, y, z,
      yaw, pitch, roll, name, description, action);
};


// Testing chunk caching utilities
describe('chunk-cache', () => {
  it('constructor', () => {
    const cache = new ChunkCache('test-db', 'tmp-chunks', 1, indexedDB);

    assert.equal(cache.dbName, 'test-db');
    assert.equal(cache.storeName, 'tmp-chunks');
    assert.equal(cache.version, 1);
    assert.strictEqual(cache.idb, indexedDB);
  });

  it('put & get', async () => {
    const cache = new ChunkCache('test-db', 'tmp-chunks', 1, indexedDB);

    const props = [dummyMakeProp(1), dummyMakeProp(2)];

    // Insert chunk in cache
    await cache.put(1, -4, 13, props);
    let res = await cache.get(1, -4, 13);

    assert.equal(res.hash, hashProps(props));
    assert.equal(res.props.length, 2);

    assert.equal(res.props[0].id, props[0].id);
    assert.equal(res.props[0].worldId, props[0].worldId);
    assert.equal(res.props[0].userId, props[0].userId);
    assert.equal(res.props[0].date, props[0].date);
    assert.ok(epsEqual(res.props[0].x, props[0].x));
    assert.ok(epsEqual(res.props[0].y, props[0].y));
    assert.ok(epsEqual(res.props[0].z, props[0].z));
    assert.ok(epsEqual(res.props[0].yaw, props[0].yaw));
    assert.ok(epsEqual(res.props[0].pitch, props[0].pitch));
    assert.ok(epsEqual(res.props[0].roll, props[0].roll));
    assert.equal(res.props[0].name, props[0].name);
    assert.equal(res.props[0].description, props[0].description);
    assert.equal(res.props[0].action, props[0].action);

    assert.equal(res.props[1].id, props[1].id);
    assert.equal(res.props[1].worldId, props[1].worldId);
    assert.equal(res.props[1].userId, props[1].userId);
    assert.equal(res.props[1].date, props[1].date);
    assert.ok(epsEqual(res.props[1].x, props[1].x));
    assert.ok(epsEqual(res.props[1].y, props[1].y));
    assert.ok(epsEqual(res.props[1].z, props[1].z));
    assert.ok(epsEqual(res.props[1].yaw, props[1].yaw));
    assert.ok(epsEqual(res.props[1].pitch, props[1].pitch));
    assert.ok(epsEqual(res.props[1].roll, props[1].roll));
    assert.equal(res.props[1].name, props[1].name);
    assert.equal(res.props[1].description, props[1].description);
    assert.equal(res.props[1].action, props[1].action);

    // Fetch list of coordinates
    res = await cache.getAvailableCoordinates(1);
    assert.equal(res.length, 1);
    assert.equal(res[0].x, -4);
    assert.equal(res[0].z, 13);

    // Update chunk in cache
    const prop = dummyMakeProp(3);
    await cache.put(1, -4, 13, [prop]);
    res = await cache.get(1, -4, 13);

    assert.equal(res.props.length, 1);

    assert.equal(res.hash, hashProps([prop]));
    assert.equal(res.props[0].id, prop.id);
    assert.equal(res.props[0].worldId, prop.worldId);
    assert.equal(res.props[0].userId, prop.userId);
    assert.equal(res.props[0].date, prop.date);
    assert.ok(epsEqual(res.props[0].x, prop.x));
    assert.ok(epsEqual(res.props[0].y, prop.y));
    assert.ok(epsEqual(res.props[0].z, prop.z));
    assert.ok(epsEqual(res.props[0].yaw, prop.yaw));
    assert.ok(epsEqual(res.props[0].pitch, prop.pitch));
    assert.ok(epsEqual(res.props[0].roll, prop.roll));
    assert.equal(res.props[0].name, prop.name);
    assert.equal(res.props[0].description, prop.description);
    assert.equal(res.props[0].action, prop.action);

    // Get unregistered chunk
    res = await cache.get(1, -3, 9);
    assert.strictEqual(res, null);

    // Insert chunk without any prop
    await cache.put(1, -5, 13, []);
    res = await cache.get(1, -5, 13);

    assert.strictEqual(res.hash, 0);
    assert.equal(res.props.length, 0);

    // Fetch list of coordinates
    res = await cache.getAvailableCoordinates(1);
    assert.equal(res.length, 2);
    assert.ok(res.find(({x, z}) => x == -4 && z == 13));
    assert.ok(res.find(({x, z}) => x == -5 && z == 13));
  });

  it('delete', async () => {
    const cache = new ChunkCache('test-db', 'tmp-chunks', 1, indexedDB);

    const props = [dummyMakeProp(1), dummyMakeProp(2)];

    // Populate the chunk with dummy data
    await cache.put(2, 20, -4, props);
    let res = await cache.get(2, 20, -4);
    assert.equal(res.props.length, 2);

    // Delete the chunk from the cache
    await cache.delete(2, 20, -4);
    res = await cache.get(2, 20, -4);
    assert.strictEqual(res, null);

    // Delete unregistered chunk from the cache
    await cache.delete(2, 21, -3);
    res = await cache.get(2, 21, -3);
    assert.strictEqual(res, null);

    res = await cache.getAvailableCoordinates(2);
    assert.equal(res.length, 0);
  });

  it('wipeWorld', async () => {
    const cache = new ChunkCache('test-db', 'tmp-chunks', 1, indexedDB);

    // Populate chunks with dummy data
    await cache.put(3, 19, -4, [dummyMakeProp(1), dummyMakeProp(2)]);
    let res = await cache.get(3, 19, -4);
    assert.equal(res.props.length, 2);

    await cache.put(3, 20, 15, [dummyMakeProp(3), dummyMakeProp(4)]);
    res = await cache.get(3, 20, 15);
    assert.equal(res.props.length, 2);

    // Add chunk to another world
    await cache.put(4, 19, -4, [dummyMakeProp(5)]);
    res = await cache.get(4, 19, -4);
    assert.equal(res.props.length, 1);

    // Delete chunks from the cache using the world ID
    await cache.wipeWorld(3);
    res = await cache.get(3, 19, -4);
    assert.strictEqual(res, null);

    res = await cache.get(3, 20, 15);
    assert.strictEqual(res, null);

    res = await cache.getAvailableCoordinates(3);
    assert.equal(res.length, 0);

    // Check that the chunk from the other world didn't get wiped out
    res = await cache.get(4, 19, -4);
    assert.equal(res.props.length, 1);

    res = await cache.getAvailableCoordinates(4);
    assert.equal(res.length, 1);
  });

  it('clear', async () => {
    const cache = new ChunkCache('test-db', 'tmp-chunks', 1, indexedDB);

    // Populate chunks with dummy data
    await cache.put(4, 19, -4, [dummyMakeProp(1), dummyMakeProp(2)]);
    let res = await cache.get(4, 19, -4);
    assert.equal(res.props.length, 2);

    await cache.put(4, 20, 15, [dummyMakeProp(3), dummyMakeProp(4)]);
    res = await cache.get(4, 20, 15);
    assert.equal(res.props.length, 2);

    // Wipe chunk cache
    await cache.clear();
    res = await cache.get(4, 19, -4);
    assert.strictEqual(res, null);

    res = await cache.get(4, 20, 15);
    assert.strictEqual(res, null);

    res = await cache.getAvailableCoordinates(4);
    assert.equal(res.length, 0);
  });
});
