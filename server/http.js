const db = require('../common/db/utils');
const World = require('../common/db/model/World').World;
const Prop = require('../common/db/model/Prop').Prop;
const express = require('express');

const httpServer = async (path, port) => {
    return db.init(path).then(async connection => {
        const httpApp = express();

        httpApp.get('/api/worlds', (req, res) => {
            res.setHeader('Content-Type', 'application/json');

            // Get a list of all existing worlds
            connection.manager.createQueryBuilder(World, 'world').getMany().then(worlds => res.send(worlds));
        });

        httpApp.get('/api/worlds/:id', (req, res) => {
            res.setHeader('Content-Type', 'application/json');

            // Get a single world using its id (return 404 if not found)
            connection.manager.createQueryBuilder(World, 'world')
                .where('world.id = :id', {id: req.params.id}).getOne().then(world => {
                    if (world) {
                        res.send(world);
                    } else {
                        res.sendStatus(404);
                    }
                });
        });

        httpApp.get('/api/worlds/:id/props', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            const wid = req.params.id

            const minX = req.query.minX
            const maxX = req.query.maxX
            const minY = req.query.minY
            const maxY = req.query.maxY
            const minZ = req.query.minZ
            const maxZ = req.query.maxZ

            // Get prop of single world using its id (return 404 if not found)
            connection.manager.createQueryBuilder(World, 'world')
                .where('world.id = :wid', {wid}).getOne().then(world => {
                    if (!world) {
                        res.sendStatus(404);
                    } else {
                        // World has been found, filter props using world ID
                        const queryBuilder = connection.manager.createQueryBuilder(Prop, 'prop')
                              .where('prop.worldId = :wid', {wid});

                        // Get chunked list of props by filtering with provided XYZ boundaries (if any)
                        if (minX) {
                            queryBuilder.andWhere('prop.x >= :minX', {minX: parseInt(minX)});
                        }

                        if (maxX) {
                            queryBuilder.andWhere('prop.x < :maxX', {maxX: parseInt(maxX)});
                        }

                        if (minY) {
                            queryBuilder.andWhere('prop.y >= :minY', {minY: parseInt(minY)});
                        }

                        if (maxY) {
                            queryBuilder.andWhere('prop.y < :maxY', {maxY: parseInt(maxY)});
                        }

                        if (minZ) {
                            queryBuilder.andWhere('prop.z >= :minZ', {minZ: parseInt(minZ)});
                        }

                        if (maxZ) {
                            queryBuilder.andWhere('prop.z < :maxZ', {maxZ: parseInt(maxZ)});
                        }

                        // Respond with list of props
                        queryBuilder.getMany().then(props => res.send(props));
                    }
                });
        });

        return httpApp.listen(port);
    });
};

module.exports = httpServer;
