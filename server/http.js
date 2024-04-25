/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import * as db from '../common/db/utils.js';
import World from '../common/db/model/World.js';
import User from '../common/db/model/User.js';
import TerrainStorage from './terrain-storage.js';
import WaterStorage from './water-storage.js';
import {packElevationData} from '../common/terrain-utils.js';
import {hasUserRole, hasUserIdInParams, middleOr, forbiddenOnFalse,
  getAuthenticationCallback} from './utils.js';
import registerPropsEndpoints from './http-props.js';
import {createServer} from 'http';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import express from 'express';
import {join} from 'node:path';
import logger from './logger.js';

const minNbUsersPerPage = 1;
const defaultNbUsersPerPage = 200;
const maxNbUsersPerPage = defaultNbUsersPerPage*10;

const spawnHttpServer = async (path, port, secret, worldFolder, userCache,
    terrainCache, waterCache) => {
  // Get a version of the authentication method working with the
  // secret we need
  const authenticate = getAuthenticationCallback(secret);

  const getTerrainStorage = (worldId) => {
    if (!terrainCache.has(worldId)) {
      const terrainPath = join(worldFolder, `${worldId}`, 'terrain');
      terrainCache.set(worldId, new TerrainStorage(terrainPath));
    }

    return terrainCache.get(worldId);
  };

  const getWaterStorage = (worldId) => {
    if (!waterCache.has(worldId)) {
      const waterPath = join(worldFolder, `${worldId}`, 'water');
      waterCache.set(worldId, new WaterStorage(waterPath));
    }

    return waterCache.get(worldId);
  };

  // Default callback for props changes (POST, PUT, DELETE)
  const ctx = {propsChangedCallback: (wid, data) => {}};

  const onPropsChange = (cb) => {
    ctx.propsChangedCallback = cb;
  };

  return db.init(path).then(async (connection) => {
    // Ready the express app
    const app = express().use(express.json()).use(cors());

    // Create http server
    const server = createServer(app);

    // Load user cache
    connection.manager.createQueryBuilder(User, 'user').getMany()
        .then((users) => {
          // Fill-in the cache by binding IDs to names and roles
          for (const user of users) {
            userCache.set(user.id, (({name, role}) => ({name, role}))(user));
          }
        }); // TODO: handle error (if any)

    app.post('/api/login', (req, res) => {
      res.setHeader('Content-Type', 'application/json');

      // We expect a json body from the request, with 'name' and
      // 'password' fields
      const username = req.body?.username || null;
      const password = req.body?.password || null;

      // Find user matching provided credentials (if any)
      connection.manager.createQueryBuilder(User, 'user')
          .where('user.name = :username', {username}).getOne().then((user) => {
            if (user && db.checkPassword(password, user.salt, user.password)) {
              // Provided password is matching
              res.send({'id': user.id, 'role': user.role,
                'token': jwt.sign({userId: user.id, userRole: user.role},
                    secret)});
            } else {
              // Invalid credentials provided: we cannot log this user in
              res.status(401).json({});
            }
          })
          .catch((e) => {
            logger.fatal('Critical DB access error while trying to log user ' +
                         `'${username}' in: ` + e);
            return res.status(500).json({});
          });
    });

    app.get('/api/worlds', authenticate, (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      // Get a list of all existing worlds
      connection.manager.createQueryBuilder(World, 'world')
          .getMany().then((worlds) => res.send(worlds))
          .catch((e) => {
            logger.fatal('Critical DB access error while trying to get list ' +
                         'of worlds: ' + e);
            return res.status(500).json({});
          });
    });

    app.get('/api/worlds/:id', authenticate, (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      // Get a single world using its id (return 404 if not found)
      connection.manager.createQueryBuilder(World, 'world')
          .where('world.id = :id', {id: req.params.id})
          .getOne().then((world) => {
            if (world) {
              res.send(world);
            } else {
              res.status(404).json({});
            }
          })
          .catch((e) => {
            logger.fatal('Critical DB access error while trying to get world ' +
                         `#${req.params.id}}: ` + e);
            return res.status(500).json({});
          });
    });

    registerPropsEndpoints(app, authenticate, connection, ctx);

    app.get('/api/worlds/:id/terrain/:x/:z/elevation', authenticate,
        (req, res) => {
          res.setHeader('Content-Type', 'application/octet-stream');
          const wid = req.params.id;
          const pageX = parseInt(req.params.x);
          const pageZ = parseInt(req.params.z);

          if (isNaN(pageX) || isNaN(pageZ)) {
            res.status(404).send();
            return;
          }

          connection.manager.createQueryBuilder(World, 'world')
              .where('world.id = :wid', {wid}).getOne().then((world) => {
                if (!world) {
                  res.status(404).send();
                  return;
                }

                getTerrainStorage(wid).getPage(pageX, pageZ).then(
                    (page) => {
                      const packed = packElevationData(page.elevationData);
                      res.send(Buffer.from(packed, 'binary'));
                    },
                );
              });
        });

    app.get('/api/worlds/:id/terrain/:x/:z/texture', authenticate,
        (req, res) => {
          res.setHeader('Content-Type', 'application/octet-stream');
          const wid = req.params.id;
          const pageX = parseInt(req.params.x);
          const pageZ = parseInt(req.params.z);

          if (isNaN(pageX) || isNaN(pageZ)) {
            res.status(404).send();
            return;
          }

          connection.manager.createQueryBuilder(World, 'world')
              .where('world.id = :wid', {wid}).getOne().then((world) => {
                if (!world) {
                  res.status(404).send();
                } else {
                  getTerrainStorage(wid).getPage(pageX, pageZ).then(
                      (page) => {
                        res.end(Buffer.from(page.textureData, 'binary'));
                      },
                  );
                }
              });
        });

    app.get('/api/worlds/:id/water/:x/:z', authenticate,
        (req, res) => {
          res.setHeader('Content-Type', 'application/octet-stream');
          const wid = req.params.id;
          const pageX = parseInt(req.params.x);
          const pageZ = parseInt(req.params.z);

          if (isNaN(pageX) || isNaN(pageZ)) {
            res.status(404).send();
            return;
          }

          connection.manager.createQueryBuilder(World, 'world')
              .where('world.id = :wid', {wid}).getOne().then((world) => {
                if (!world) {
                  res.status(404).send();
                  return;
                }

                getWaterStorage(wid).getPage(pageX, pageZ).then(
                    (page) => {
                      const packed = packElevationData(page);
                      res.send(Buffer.from(packed, 'binary'));
                    },
                );
              });
        });

    app.get('/api/users', authenticate, forbiddenOnFalse(hasUserRole('admin')),
        (req, res) => {
          res.setHeader('Content-Type', 'application/json');

          // Fetch pagination info from query parameters (if any)
          const page = req.query.page ? parseInt(req.query.page) : 0;
          const amount = req.query.amount ? parseInt(req.query.amount) :
              defaultNbUsersPerPage;

          if (!isFinite(page) || !isFinite(amount) ||
              amount > maxNbUsersPerPage ||
              amount < minNbUsersPerPage ||
              page < 0) {
            res.status(400).json({});
            return;
          }

          // Get a list of all existing users
          connection.manager.createQueryBuilder(User, 'user')
              .skip(page*amount).take(amount).getMany().then((users) =>
                res.send(users.map((user) => (({id, name, email, role}) =>
                  ({id, name, email, role}))(user))),
              )
              .catch((e) => {
                logger.fatal('Critical DB access error while trying to get ' +
                             'list of users: ' + e);
                return res.status(500).json({});
              });
        });

    app.get('/api/users/:id', authenticate, forbiddenOnFalse(
        middleOr(hasUserRole('admin'), hasUserIdInParams('id'))),
    (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      // Get a single user using their id (return 404 if not found)
      connection.manager.createQueryBuilder(User, 'user')
          .where('user.id = :id', {id: req.params.id}).getOne().then((user) => {
            if (user) {
              res.send(JSON.stringify(user, ['id', 'name', 'email', 'role']));
            } else {
              res.status(404).json({});
            }
          })
          .catch((e) => {
            logger.fatal('Critical DB access error while trying to get user ' +
                         `#${req.params.id}: ` + e);
            return res.status(500).json({});
          });
    });

    server.on('close', async () => {
      // Close DB connection along with webserver
      await connection.close();
    });

    server.listen(port);

    return {server, onPropsChange};
  });
};

export {spawnHttpServer};
