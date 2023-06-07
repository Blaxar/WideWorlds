/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import World from '../common/db/model/World.js';
import Prop from '../common/db/model/Prop.js';

/**
 * Register props-related endpoints into the expressjs app
 * @param {Object} app - express.js app.
 * @param {function} authenticate - Authentication function for the http
 *                                  requests.
 * @param {Object} connection - TypeORM connection instance.
 */
function registerPropsEndpoints(app, authenticate, connection) {
  app.get('/api/worlds/:id/props', authenticate, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const wid = req.params.id;

    let minX = req.query.minX;
    let maxX = req.query.maxX;
    let minY = req.query.minY;
    let maxY = req.query.maxY;
    let minZ = req.query.minZ;
    let maxZ = req.query.maxZ;

    // Get prop of single world using its id (return 404 if not found)
    connection.manager.createQueryBuilder(World, 'world')
        .where('world.id = :wid', {wid}).getOne().then((world) => {
          if (!world) {
            res.status(404).json({});
            return;
          }

          // World has been found, filter props using world ID
          const queryBuilder =
              connection.manager.createQueryBuilder(Prop, 'prop')
                  .where('prop.worldId = :wid', {wid});

          // Get chunked list of props by filtering with provided XYZ
          // boundaries (if any)
          if (minX) {
            minX = parseInt(minX);

            if (!isFinite(minX)) {
              res.status(400).json({});
              return;
            }

            queryBuilder.andWhere('prop.x >= :minX', {minX});
          }

          if (maxX) {
            maxX = parseInt(maxX);

            if (!isFinite(maxX)) {
              res.status(400).json({});
              return;
            }

            queryBuilder.andWhere('prop.x < :maxX', {maxX});
          }

          if (minY) {
            minY = parseInt(minY);

            if (!isFinite(minY)) {
              res.status(400).json({});
              return;
            }

            queryBuilder.andWhere('prop.y >= :minY', {minY});
          }

          if (maxY) {
            maxY = parseInt(maxY);

            if (!isFinite(maxY)) {
              res.status(400).json({});
              return;
            }

            queryBuilder.andWhere('prop.y < :maxY', {maxY});
          }

          if (minZ) {
            minZ = parseInt(minZ);

            if (!isFinite(minZ)) {
              res.status(400).json({});
              return;
            }

            queryBuilder.andWhere('prop.z >= :minZ', {minZ});
          }

          if (maxZ) {
            maxZ = parseInt(maxZ);

            if (!isFinite(maxZ)) {
              res.status(400).json({});
              return;
            }

            queryBuilder.andWhere('prop.z < :maxZ', {maxZ});
          }

          // Respond with list of props
          queryBuilder.getMany().then((props) => res.send(props));
        })
        .catch((err) => res.status(500).json({}));
  });

  app.put('/api/worlds/:id/props', authenticate, (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    // Get world ID
    const wid = req.params.id;

    // Get user ID and role
    const userRole = req.userRole;
    const userId = req.userId;
    // Expect a json dictionary holding prop properties, indexed by prop id
    const props = req.body || {};

    // We will respond with a dictionary as well
    const response = {};

    connection.manager.createQueryBuilder(World, 'world')
        .where('world.id = :wid', {wid}).getOne().then(async (world) => {
          if (!world) {
            res.status(404).json({});
            return;
          }

          // World has been found: time to evaluate the content of the payload
          for (const [key, value] of Object.entries(props)) {
            response[key] = null;
            const propId = parseInt(key);

            if (isNaN(propId)) {
            // Not found
              continue;
            }

            await connection.manager.createQueryBuilder(Prop, 'prop')
                .where('prop.worldId = :wid', {wid})
                .andWhere('prop.id = :propId', {propId}).getOne()
                .then(async (prop) => {
                  if (!prop) {
                    // Not found
                    return;
                  } else if (userRole !== 'admin' && prop.uid != userId) {
                    response[key] = false; // Not allowed
                    return;
                  }

                  // Apply all meaningful fields
                  prop.date = Date.now();
                  prop.x = value.x !== undefined ? value.x : prop.x;
                  prop.y = value.y !== undefined ? value.y : prop.y;
                  prop.z = value.z !== undefined ? value.z : prop.z;
                  prop.yaw = value.yaw !== undefined ? value.yaw : prop.yaw;
                  prop.pitch = value.pitch !== undefined ?
                      value.pitch : prop.pitch;
                  prop.roll = value.roll !== undefined ? value.roll : prop.roll;
                  prop.name = value.name ? value.name : prop.name;
                  prop.description = value.description ?
                  value.description : prop.description;
                  prop.action = value.action ?
                  value.action : prop.action;

                  // Save updated prop to DB
                  await connection.manager.save([prop]);
                  response[key] = true;
                });
          }

          res.json(response);
        });
  });
}

export default registerPropsEndpoints;
