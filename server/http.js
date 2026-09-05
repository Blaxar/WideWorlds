/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import * as db from '../common/db/utils.js';
import User from '../common/db/model/User.js';
import TerrainStorage from './terrain-storage.js';
import WaterStorage from './water-storage.js';
import {packElevationData} from '../common/terrain-utils.js';
import {getAuthenticationCallback, formatHttpErrors, loadCaches,
  pathIdSanitizer} from './utils.js';
import registerPropsEndpoints from './http-props.js';
import registerUsersEndpoints from './http-users.js';
import {createServer} from 'http';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import express from 'express';
import {param, validationResult} from 'express-validator';
import {join} from 'node:path';
import logger from './logger.js';

const spawnHttpServer = async (path, port, secret, worldFolder, worldCache,
    userCache, terrainCache, waterCache) => {
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
  const propsCtx = {propsChangedCallback: (wid, data) => {}};

  // User cache for the user endpoints
  const usersCtx = {userCache};

  const onPropsChange = (cb) => {
    propsCtx.propsChangedCallback = cb;
  };

  /*
   * World ID validator for user API requests (GET, PUT and DELETE)
   */
  const worldIdValidator = param('id').custom((id) => worldCache.has(id));

  /*
   * Page sanitizers for requests with :x and :z parameters, parses them
   * to integers
   */
  const worldPageSanitizers = [
    (param('x').customSanitizer((x) => parseInt(x))),
    (param('z').customSanitizer((z) => parseInt(z))),
  ];

  /*
   * World Page (X and Z) validators for user API requests
   */
  const worldPageValidators = [
    (param('x').custom((x) => !isNaN(x))),
    (param('z').custom((z) => !isNaN(z))),
  ];

  return db.init(path).then(async (connection) => {
    // Ready the express app
    const app = express().use(express.json()).use(cors());

    // Create http server
    const server = createServer(app);

    // Load world and user caches
    loadCaches(connection.manager, worldCache, userCache);

    /**
     * @openapi
     * /api/login:
     *   post:
     *     description: Authenticate a user based on the provided credentials
     *     operationId: login
     *     requestBody:
     *       description: Credentials for user authentication
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             properties:
     *               username:
     *                 description: Username in plain text
     *                 type: string
     *                 example: John
     *               password:
     *                 description: Password in plain text
     *                 type: string
     *                 example: p.4SsW0r-*D
     *     responses:
     *       200:
     *         description: Successful authentication
     *         content:
     *           application/json:
     *             schema:
     *               properties:
     *                 id:
     *                   type: integer
     *                   description: ID of the user
     *                   example: 3247
     *                 role:
     *                   type: string
     *                   description: |
     *                     Role of the user, can be one of `admin`, \
     *                     `citizen` or `tourist`
     *                   example: citizen
     *                 token:
     *                   type: string
     *                   description: Authentication token
     *                   example: eyJhbGciOiJ...kVUQjE
     *       401:
     *         description: Invalid credentials
     *       500:
     *         description: Internal error
     */
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

    /**
     * @openapi
     * components:
     *   securitySchemes:
     *     bearerAuth:
     *       type: http
     *       scheme: bearer
     *       bearerFormat: JWT
     *
     *   schemas:
     *     World:
     *       type: object
     *       properties:
     *         id:
     *           description: ID of the world
     *           type: integer
     *           example: 3247
     *         name:
     *           description: Displayable name of the world
     *           type: string
     *           example: Natura
     *         data:
     *           description: Data dictionary of the world
     *           type: object
     *           example: { "name": "Natura", "path": "https://mydomain.com/aw/path" }
     *
     *     AllWorlds:
     *       type: array
     *       description: List of available worlds to connect to
     *       items:
     *         $ref: '#/components/schemas/World'
     *
     */

    /**
     * @openapi
     * /api/worlds:
     *   get:
     *     description: Get the list of available worlds
     *     operationId: get-worlds
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Successful request listing all available worlds
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/AllWorlds'
     *       401:
     *         description: Authentication required
     *       403:
     *         description: Action not allowed for this user
     *       500:
     *         description: Internal error
     */
    app.get('/api/worlds', authenticate, (req, res) => {
      res.setHeader('Content-Type', 'application/json');

      // Get a list of all existing worlds
      res.json([...worldCache.values()]);
    });

    /**
     * @openapi
     * /api/worlds/{worldId}:
     *   get:
     *     description: Get information about a single world
     *     operationId: get-world
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: worldId
     *         schema:
     *           type: integer
     *         required: true
     *         description: Numeric ID of the world to get
     *     responses:
     *       200:
     *         description: Successful request getting information about
     *                      a single world
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/World'
     *       401:
     *         description: Authentication required
     *       403:
     *         description: Action not allowed for this user
     *       404:
     *         description: World not found given the provided ID
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ValidationErrorResponse'
     *       500:
     *         description: Internal error
     */
    app.get('/api/worlds/:id', authenticate, pathIdSanitizer,
        worldIdValidator, (req, res) => {
          const errors = validationResult(req);
          res.setHeader('Content-Type', 'application/json');

          // Get a single world using its id (return 404 if not found)
          if (!errors.isEmpty()) {
            res.status(404).json(formatHttpErrors(errors));
            return;
          }

          res.json(worldCache.get(req.params.id));
        });

    // Props endpoints are handled in a separate file
    registerPropsEndpoints(app, authenticate, connection, propsCtx);

    // Users endpoints are handled in a separate file
    registerUsersEndpoints(app, authenticate, connection, usersCtx);

    /**
     * @openapi
     * /api/worlds/{worldId}/{x}/{z}/elevation:
     *   get:
     *     description: Get terrain elevation data for a single page
     *                  a of a single world
     *     operationId: get-world-elevation
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: worldId
     *         schema:
     *           type: integer
     *         required: true
     *         description: Numeric ID of the world to get
     *       - in: path
     *         name: x
     *         schema:
     *           type: integer
     *         required: true
     *         description: Page position along the X axis
     *       - in: path
     *         name: z
     *         schema:
     *           type: integer
     *         required: true
     *         description: Page position along the Z axis
     *     responses:
     *       200:
     *         description: Binary payload for elevation data
     *         content:
     *           application/octet-stream:
     *             schema:
     *               type: string
     *               format: binary
     *       401:
     *         description: Authentication required
     *       403:
     *         description: Action not allowed for this user
     *       404:
     *         description: World or page not found given the provided IDs
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ValidationErrorResponse'
     *       500:
     *         description: Internal error
     */
    app.get('/api/worlds/:id/terrain/:x/:z/elevation', authenticate,
        pathIdSanitizer, ...worldPageSanitizers, worldIdValidator,
        ...worldPageValidators, (req, res) => {
          const errors = validationResult(req);

          const wid = req.params.id;
          const pageX = req.params.x;
          const pageZ = req.params.z;

          if (!errors.isEmpty()) {
            res.setHeader('Content-Type', 'application/json');
            res.status(404).json(formatHttpErrors(errors));
            return;
          }

          getTerrainStorage(wid).getPage(pageX, pageZ).then(
              (page) => {
                const packed = packElevationData(page.elevationData);
                res.setHeader('Content-Type', 'application/octet-stream');
                res.send(Buffer.from(packed, 'binary'));
              });
        });

    /**
     * @openapi
     * /api/worlds/{worldId}/{x}/{z}/texture:
     *   get:
     *     description: Get terrain texture data for a single page
     *                  a of a single world
     *     operationId: get-world-texture
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: worldId
     *         schema:
     *           type: integer
     *         required: true
     *         description: Numeric ID of the world to get
     *       - in: path
     *         name: x
     *         schema:
     *           type: integer
     *         required: true
     *         description: Page position along the X axis
     *       - in: path
     *         name: z
     *         schema:
     *           type: integer
     *         required: true
     *         description: Page position along the Z axis
     *     responses:
     *       200:
     *         description: Binary payload for texture data
     *         content:
     *           application/octet-stream:
     *             schema:
     *               type: string
     *               format: binary
     *       401:
     *         description: Authentication required
     *       403:
     *         description: Action not allowed for this user
     *       404:
     *         description: World or page not found given the provided ID
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ValidationErrorResponse'
     *       500:
     *         description: Internal error
     */
    app.get('/api/worlds/:id/terrain/:x/:z/texture', authenticate,
        pathIdSanitizer, ...worldPageSanitizers, worldIdValidator,
        ...worldPageValidators, (req, res) => {
          const errors = validationResult(req);

          const wid = req.params.id;
          const pageX = req.params.x;
          const pageZ = req.params.z;

          if (!errors.isEmpty()) {
            res.setHeader('Content-Type', 'application/json');
            res.status(404).json(formatHttpErrors(errors));
            return;
          }

          getTerrainStorage(wid).getPage(pageX, pageZ).then(
              (page) => {
                res.setHeader('Content-Type', 'application/octet-stream');
                res.end(Buffer.from(page.textureData, 'binary'));
              });
        });

    /**
     * @openapi
     * /api/worlds/{worldId}/{x}/{z}/water:
     *   get:
     *     description: Get water elevation data for a single page
     *                  a of a single world
     *     operationId: get-world-water
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: worldId
     *         schema:
     *           type: integer
     *         required: true
     *         description: Numeric ID of the world to get
     *       - in: path
     *         name: x
     *         schema:
     *           type: integer
     *         required: true
     *         description: Page position along the X axis
     *       - in: path
     *         name: z
     *         schema:
     *           type: integer
     *         required: true
     *         description: Page position along the Z axis
     *     responses:
     *       200:
     *         description: Binary payload for elevation data
     *         content:
     *           application/octet-stream:
     *             schema:
     *               type: string
     *               format: binary
     *       401:
     *         description: Authentication required
     *       403:
     *         description: Action not allowed for this user
     *       404:
     *         description: World or page not found given the provided ID
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ValidationErrorResponse'
     *       500:
     *         description: Internal error
     */
    app.get('/api/worlds/:id/water/:x/:z', authenticate,
        pathIdSanitizer, ...worldPageSanitizers, worldIdValidator,
        ...worldPageValidators, (req, res) => {
          const errors = validationResult(req);

          const wid = req.params.id;
          const pageX = req.params.x;
          const pageZ = req.params.z;

          if (!errors.isEmpty()) {
            res.setHeader('Content-Type', 'application/json');
            res.status(404).json(formatHttpErrors(errors));
            return;
          }

          getWaterStorage(wid).getPage(pageX, pageZ).then(
              (page) => {
                const packed = packElevationData(page);
                res.setHeader('Content-Type', 'application/octet-stream');
                res.send(Buffer.from(packed, 'binary'));
              },
          );
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
