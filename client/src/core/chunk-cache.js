/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {serializeProp, deserializeProp, packPropData, unpackPropData, hashProps}
  from '../../../common/props-data-format.js';

const makeChunkTag = (worldId, x, z) => `${worldId}_${x}_${z}`;

/**
 * @typedef ChunkProps
 * @type {object}
 * @property {timestamp} hash - Hash of the props the chunk, zero (0) if none.
 * @property {Array<Prop>} props - List of props from the chunk.
 */

/**
 * @typedef ChunkCoords
 * @type {object}
 * @property {integer} x - Index of the chunk along the X-axis.
 * @property {integer} z - Index of the chunk along the Z-axis.
 */

/** Cache management for chunks of props, powered by IndexedDB */
class ChunkCache {
  /**
   * @constructor
   * @param {string} dbName - Name of the database.
   * @param {string} storeName - Name of the store for the chunks.
   * @param {integer} version - Version of the database.
   * @param {IndexedDB} idb - Instance of IndexedDB.
   */
  constructor(dbName = 'WideWorlds', storeName = 'chunks', version = 1,
      idb = window.indexedDB) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.version = version;
    this.idb = idb;

    const request = idb.open(this.dbName, this.version);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const objectStore = db.createObjectStore(this.storeName,
          {keyPath: 'tag'});

      objectStore.createIndex('worldId', 'worldId');
      objectStore.createIndex('x', 'x');
      objectStore.createIndex('z', 'z');
      objectStore.createIndex('data', 'data');
    };
  }

  /**
   * Put a chunk in the cache, override existing entry if any
   *
   * @param {integer} worldId - ID of the world this chunk belongs to.
   * @param {integer} x - Index of this chunk along the X-axis.
   * @param {integer} z - Index of this chunk along the Z-axis.
   * @param {Array<Prop>} props - List of props in this chunk.
   * @return {Promise<undefined>} Promise hanging on the completion
   *                              of the transaction.
   */
  put(worldId, x, z, props) {
    return new Promise((resolve, reject) => {
      const request = this.idb.open(this.dbName, this.version);

      request.onerror = (event) => reject(event);
      request.onsuccess = (event) => {
        const tag = makeChunkTag(worldId, x, z);
        const store = event.target.result.transaction([this.storeName],
            'readwrite').objectStore(this.storeName);

        const pack = packPropData(props.map((prop) => {
          return serializeProp(prop);
        }));

        const data = new Blob([pack.buffer]);

        const put = store.put({worldId, x, z, data, tag});

        put.onerror = (event) => reject(event);
        put.onsuccess = (event) => resolve();
      };
    });
  }

  /**
   * Get a chunk from the cache
   *
   * @param {integer} worldId - ID of the world this chunk belongs to.
   * @param {integer} x - Index of this chunk along the X-axis.
   * @param {integer} z - Index of this chunk along the Z-axis.
   * @return {Promise<ChunkProps>} Promise of the list of props from
   *                               this chunk.
   */
  get(worldId, x, z) {
    return new Promise((resolve, reject) => {
      const request = this.idb.open(this.dbName, this.version);

      request.onerror = (event) => reject(event);
      request.onsuccess = (event) => {
        const tag = makeChunkTag(worldId, x, z);
        const store = event.target.result.transaction([this.storeName],
            'readonly').objectStore(this.storeName);
        const get = store.get(tag);

        get.onerror = (event) => reject(event);
        get.onsuccess = (event) => {
          if (!event.target.result || !event.target.result.data) {
            resolve(null);
            return;
          }

          event.target.result.data.arrayBuffer()
              .then((pack) => {
                const props =
                    unpackPropData(new Uint8Array(pack))
                        .map((arr) => deserializeProp(arr));
                resolve({hash: hashProps(props), props});
              }).catch((err) => reject(err));
        };
      };
    });
  }

  /**
   * Get all available chunks coordinates from the cache for a given world
   *
   * @param {integer} worldId - ID of the world the chunks belongs to.
   * @return {Promise<Array<ChunkCoords>>} Promise of a list of chunk
   *                                       coordinates.
   */
  getAvailableCoordinates(worldId) {
    return new Promise((resolve, reject) => {
      const request = this.idb.open(this.dbName, this.version);

      request.onerror = (event) => reject(event);
      request.onsuccess = (event) => {
        const store = event.target.result.transaction([this.storeName],
            'readonly').objectStore(this.storeName);
        const get = store.index('worldId').getAll(worldId);

        get.onerror = (event) => reject(event);
        get.onsuccess = (event) => {
          if (!event.target.result) {
            resolve(null);
            return;
          }

          const coords = [];

          event.target.result.forEach(({x, z}) => {
            coords.push({x, z});
          });

          resolve(coords);
        };
      };
    });
  }

  /**
   * Delete a chunk from the cache
   *
   * @param {integer} worldId - ID of the world this chunk belongs to.
   * @param {integer} x - Index of this chunk along the X-axis.
   * @param {integer} z - Index of this chunk along the Z-axis.
   * @return {Promise<undefined>} Promise hanging on the completion
   *                              of the transaction, will be
   *                              successful even if the chunk
   *                              wasn't stored.
   */
  delete(worldId, x, z) {
    return new Promise((resolve, reject) => {
      const request = this.idb.open(this.dbName, this.version);

      request.onerror = (event) => reject(event);
      request.onsuccess = (event) => {
        const tag = makeChunkTag(worldId, x, z);
        const store = event.target.result.transaction([this.storeName],
            'readwrite').objectStore(this.storeName);
        const del = store.delete(tag);

        del.onerror = (event) => reject(event);
        del.onsuccess = (event) => resolve();
      };
    });
  }

  /**
   * Wipe all chunks belonging to a given world
   *
   * @param {integer} worldId - ID of the world this chunk belongs to.
   * @param {integer} x - Index of this chunk along the X-axis.
   * @param {integer} z - Index of this chunk along the Z-axis.
   * @return {Promise<undefined>} Promise hanging on the completion
   *                              of the transaction, will be
   *                              successful even if there was
   *                              no chunk matching this worldID
   *                              to begin with.
   */
  wipeWorld(worldId) {
    return this.deleteRange('worldId', IDBKeyRange.only(worldId));
  }

  /**
   * Wipe all and every chunk from the store
   *
   * @return {Promise<undefined>} Promise hanging on the completion
   *                              of the transaction, will be
   *                              successful even if there was
   *                              no chunk to begin with.
   */
  clear() {
    return this.deleteRange();
  }

  /**
   * Remove chunks given a range for a certain index, for internal
   * use by {@link wipeWorld} and {@link clear}
   *
   * @param {IDBIndex|undefined} index - Index to match, will wipe everything
   *                                     if undefined.
   * @param {IDBKeyRange|undefined} keyRange - Range to match, will wipe
   *                                           everything if undefined.
   * @return {Promise<undefined>} Promise hanging on the completion
   *                              of the transaction, will be
   *                              successful even if there was
   *                              no chunk to begin with.
   */
  deleteRange(index = undefined, keyRange = undefined) {
    return new Promise((resolve, reject) => {
      const request = this.idb.open(this.dbName, this.version);

      request.onerror = (event) => reject(event);
      request.onsuccess = (event) => {
        const store = event.target.result.transaction([this.storeName],
            'readwrite').objectStore(this.storeName);

        // Open a key cursor with a custom range, this will iterate over
        // all the data in the store matching it, or every single entry
        // if the range is undefined
        const del = index && keyRange ?
            store.index(index).openKeyCursor(keyRange) :
            store.openKeyCursor();

        del.onerror = (event) => reject(event);
        del.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            store.delete(cursor.primaryKey);
            cursor.continue();
          } else {
            resolve();
          }
        };
      };
    });
  }
}

export default ChunkCache;
