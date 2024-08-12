/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import logger from './logger.js';
import World from '../common/db/model/World.js';
import Prop from '../common/db/model/Prop.js';
import {hashProps} from '../common/props-data-format.js';

const isNullOrUndefined = (value) => value === null || value === undefined;
const badRequest = 400;
const ok = 200;

/**
 * Add filters to props database query
 *
 * @param {QueryBuilder} queryBuilder - Instance of the TypeORM query builder.
 * @param {integer} wid - ID of the world holding the props.
 * @param {integer} minX - Minimum (including) X coordinate to filter props by.
 * @param {integer} maxX - Maximum (exluding) X coordinate to filter props by.
 * @param {integer} minY - Minimum (including) Y coordinate to filter props by.
 * @param {integer} maxY - Maximum (exluding) Y coordinate to filter props by.
 * @param {integer} minZ - Minimum (including) Z coordinate to filter props by.
 * @param {integer} maxZ - Maximum (exluding) Z coordinate to filter props by.
 *
 * @return {integer} HTTP status code to respond with.
 */
function filterPropsQuery(queryBuilder, wid,
    {minX, maxX, minY, maxY, minZ, maxZ}) {
  queryBuilder.where('prop.worldId = :wid', {wid});

  // Get chunked list of props by filtering with provided XYZ
  // boundaries (if any)
  if (minX) {
    minX = parseInt(minX);

    if (!isFinite(minX)) {
      return badRequest;
    }

    queryBuilder.andWhere('prop.x >= :minX', {minX});
  }

  if (maxX) {
    maxX = parseInt(maxX);

    if (!isFinite(maxX)) {
      return badRequest;
    }

    queryBuilder.andWhere('prop.x < :maxX', {maxX});
  }

  if (minY) {
    minY = parseInt(minY);

    if (!isFinite(minY)) {
      return badRequest;
    }

    queryBuilder.andWhere('prop.y >= :minY', {minY});
  }

  if (maxY) {
    maxY = parseInt(maxY);

    if (!isFinite(maxY)) {
      return badRequest;
    }

    queryBuilder.andWhere('prop.y < :maxY', {maxY});
  }

  if (minZ) {
    minZ = parseInt(minZ);

    if (!isFinite(minZ)) {
      return badRequest;
    }

    queryBuilder.andWhere('prop.z >= :minZ', {minZ});
  }

  if (maxZ) {
    maxZ = parseInt(maxZ);

    if (!isFinite(maxZ)) {
      return badRequest;
    }

    queryBuilder.andWhere('prop.z < :maxZ', {maxZ});
  }

  return ok;
}

/**
 * Register props-related endpoints into the expressjs app
 * @param {Object} app - express.js app.
 * @param {function} authenticate - Authentication function for the http
 *                                  requests.
 * @param {Object} connection - TypeORM connection instance.
 * @param {Object} ctx - Parent HTTP spawner context.
 */
function registerPropsEndpoints(app, authenticate, connection, ctx) {
  app.get('/api/worlds/:id/props', authenticate, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const wid = req.params.id;

    const minX = req.query.minX;
    const maxX = req.query.maxX;
    const minY = req.query.minY;
    const maxY = req.query.maxY;
    const minZ = req.query.minZ;
    const maxZ = req.query.maxZ;

    // Get prop of single world using its id (return 404 if not found)
    connection.manager.createQueryBuilder(World, 'world')
        .where('world.id = :wid', {wid}).getOne().then((world) => {
          if (!world) {
            res.status(404).json({});
            return;
          }

          // World has been found, filter props using world ID
          const queryBuilder =
                connection.manager.createQueryBuilder(Prop, 'prop');

          const status = filterPropsQuery(queryBuilder, wid,
              {minX, maxX, minY, maxY, minZ, maxZ});

          if (status === ok) {
            // Respond with list of props
            queryBuilder.getMany().then((props) => res.send(props));
          } else {
            res.status(status).json({});
          }
        })
        .catch((e) => {
          logger.fatal('Critical DB access error while trying to get props ' +
              `for world #${wid}: ` + e);
          return res.status(500).json({});
        });
  });

  app.get('/api/worlds/:id/props-hash', authenticate, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const wid = req.params.id;

    const minX = req.query.minX;
    const maxX = req.query.maxX;
    const minY = req.query.minY;
    const maxY = req.query.maxY;
    const minZ = req.query.minZ;
    const maxZ = req.query.maxZ;

    connection.manager.createQueryBuilder(World, 'world')
        .where('world.id = :wid', {wid}).getOne().then((world) => {
          if (!world) {
            res.status(404).json({});
            return;
          }

          // World has been found, filter props using world ID
          const queryBuilder =
                connection.manager.createQueryBuilder(Prop, 'prop');

          const status = filterPropsQuery(queryBuilder, wid,
              {minX, maxX, minY, maxY, minZ, maxZ});

          if (status === ok) {
            // Respond with hash of props
            queryBuilder.getMany().then((props) => {
              res.send({hash: hashProps(props)});
            });
          } else {
            res.status(status).json({});
          }
        })
        .catch((e) => {
          logger.fatal('Critical DB access error while trying to get props ' +
              `for world #${wid}: ` + e);
          return res.status(500).json({});
        });
  });

  app.put('/api/worlds/:id/props', authenticate, (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    // Get world ID
    const wid = req.params.id;

    // Get user ID and role
    const userRole = req.userRole;
    const userId = req.userId;

    const props = req.body;

    // We will respond with a dictionary as well
    const response = {};

    connection.manager.createQueryBuilder(World, 'world')
        .where('world.id = :wid', {wid}).getOne().then(async (world) => {
          if (!world) {
            res.status(404).json({});
            return;
          }

          const propsToQuery = [];
          const propsToSave = [];

          // World has been found: time to evaluate the content of the payload
          for (const [key, value] of Object.entries(props)) {
            if (value.constructor.name !== 'Object') {
              // Entry needs to be an object
              res.status(400).json({});
              return;
            }

            response[key] = null;
            const propId = parseInt(key);

            if (isNaN(propId)) {
              // Not found
              continue;
            }

            propsToQuery.push(propId);
          }

          await connection.manager.createQueryBuilder(Prop, 'prop')
              .where('prop.worldId = :wid', {wid})
              .andWhere('prop.id IN (:...entries)', {entries: propsToQuery})
              .getMany().then((dbProps) => {
                for (const prop of dbProps) {
                  if (userRole !== 'admin' && prop.userId != userId) {
                    response[prop.id] = false; // Not allowed
                    continue;
                  }

                  const value = props[prop.id];

                  // Apply all meaningful fields
                  prop.date = Date.now();
                  prop.x = isNullOrUndefined(value.x) ? prop.x : value.x;
                  prop.y = isNullOrUndefined(value.y) ? prop.y : value.y;
                  prop.z = isNullOrUndefined(value.z) ? prop.z : value.z;
                  prop.yaw = isNullOrUndefined(value.yaw) ? prop.yaw :
                    value.yaw;
                  prop.pitch = isNullOrUndefined(value.pitch) ?
                    prop.pitch : value.pitch;
                  prop.roll = isNullOrUndefined(value.roll) ? prop.roll :
                    value.roll;
                  prop.name = isNullOrUndefined(value.name) ? prop.name :
                    value.name;
                  prop.description = isNullOrUndefined(value.description) ?
                    prop.description : value.description;
                  prop.action = isNullOrUndefined(value.action) ?
                    prop.action : value.action;

                  propsToSave.push(prop);
                  response[prop.id] = true;
                }
              });

          // Save updated props to DB
          if (propsToSave.length) {
            connection.manager.save(propsToSave).then(() => {
              res.json(response);
              ctx.propsChangedCallback(wid,
                  JSON.stringify({op: 'update', data: propsToSave}));
            })
                .catch((e) => {
                  logger.fatal('Critical DB access error while trying to ' +
                               `put props for world #${wid}: ` + e);
                  return res.status(500).json({});
                });
          } else {
            res.json(response);
          }
        });
  });

  app.post('/api/worlds/:id/props', authenticate, (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    // Get world ID
    const wid = req.params.id;

    // Get user ID
    const userId = req.userId;

    const props = req.body;
    const propsToSave = [];

    connection.manager.createQueryBuilder(World, 'world')
        .where('world.id = :wid', {wid}).getOne().then(async (world) => {
          if (!world) {
            res.status(404).json({});
            return;
          }

          if (props.constructor.name !== 'Array') {
            // Payload needs to be an array
            res.status(400).json({});
            return;
          }

          // We will respond with an array as well
          const response = [];

          for (const value of props) {
            if (value.constructor.name !== 'Object') {
              // Entry needs to be an object
              res.status(400).json({});
              return;
            }

            if (isNullOrUndefined(value.x) ||
                isNaN(parseFloat(value.x)) ||
                isNullOrUndefined(value.y) ||
                isNaN(parseFloat(value.y)) ||
                isNullOrUndefined(value.z) ||
                isNaN(parseFloat(value.z)) ||
                isNullOrUndefined(value.yaw) ||
                isNaN(parseFloat(value.yaw)) ||
                isNullOrUndefined(value.pitch) ||
                isNaN(parseFloat(value.pitch)) ||
                isNullOrUndefined(value.roll) ||
                isNaN(parseFloat(value.roll)) ||
                isNullOrUndefined(value.name) ||
                isNullOrUndefined(value.description) ||
                isNullOrUndefined(value.action)
            ) {
              // Invalid or missing field values
              response.push(null);
              continue;
            }

            const prop = new Prop(
                undefined,
                wid,
                userId,
                Date.now(),
                value.x,
                value.y,
                value.z,
                value.yaw,
                value.pitch,
                value.roll,
                value.name,
                value.description,
                value.action,
            );

            propsToSave.push(prop);
            response.push(true);
          }

          // Save created props to DB
          if (propsToSave.length) {
            connection.manager.save(propsToSave)
                .then((savedProps) => {
                  res.json(response);
                  ctx.propsChangedCallback(wid,
                      JSON.stringify({op: 'create', data: savedProps}));
                })
                .catch((e) => {
                  logger.fatal('Critical DB access error while trying to ' +
                               `post props for world #${wid}: ` + e);
                  return res.status(500).json({});
                });
          } else {
            res.json(response);
          }
        });
  });

  app.delete('/api/worlds/:id/props', authenticate, (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    // Get world ID
    const wid = req.params.id;

    // Get user ID and role
    const userRole = req.userRole;
    const userId = req.userId;

    const props = req.body;

    connection.manager.createQueryBuilder(World, 'world')
        .where('world.id = :wid', {wid}).getOne().then(async (world) => {
          if (!world) {
            res.status(404).json({});
            return;
          }

          if (props.constructor.name !== 'Array') {
            // Payload needs to be an array
            res.status(400).json({});
            return;
          }

          if (new Set(props).size !== props.length) {
            // The array cannot have duplicated values
            res.status(400).json({});
            return;
          }

          const propsToQuery = [];
          const propsToDelete = [];
          const propIdtoEntry = {};

          // We will respond with an array as well
          const response = [];
          response.length = props.length;
          response.fill(null, 0, props.length);

          // Evaluate the content of the payload
          for (const [id, propId] of Object.entries(props)) {
            if (!Number.isInteger(propId) || propId < 0) {
              // Entry needs to be a positive integer
              res.status(400).json({});
              return;
            }

            propsToQuery.push(propId);
            propIdtoEntry[propId] = id;
          }

          await connection.manager.createQueryBuilder(Prop, 'prop')
              .where('prop.worldId = :wid', {wid})
              .andWhere('prop.id IN (:...entries)', {entries: propsToQuery})
              .getMany().then((dbProps) => {
                for (const prop of dbProps) {
                  if (userRole !== 'admin' && prop.userId != userId) {
                    response[propIdtoEntry[prop.id]] = false; // Not allowed
                    continue;
                  }

                  propsToDelete.push(prop.id);
                  response[propIdtoEntry[prop.id]] = true;
                }
              });

          // Delete props from DB
          if (propsToDelete.length) {
            connection.manager.createQueryBuilder(Prop, 'prop')
                .delete()
                .where('prop.worldId = :wid', {wid})
                .andWhere('prop.id IN (:...entries)', {entries: propsToDelete})
                .execute()
                .then(() => {
                  res.json(response);
                  ctx.propsChangedCallback(wid,
                      JSON.stringify({op: 'delete', data: propsToDelete}));
                })
                .catch((e) => {
                  logger.fatal('Critical DB access error while trying to ' +
                               `delete props for world #${wid}: ` + e);
                  return res.status(500).json({});
                });
          } else {
            res.json(response);
          }
        });
  });
}

export default registerPropsEndpoints;
