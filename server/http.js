import * as db from '../common/db/utils.js';
import World from '../common/db/model/World.js';
import Prop from '../common/db/model/Prop.js';
import User from '../common/db/model/User.js';
import {createServer} from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';

const bearerRegex = /^Bearer (.*)$/i;

const spawnHttpServer = async (path, port, secret) => {
    const authenticate = (req, res, next) => {
        // Get Bearer token, we strip the 'Bearer' part
        const authMatch = req.headers['authorization']?.match(bearerRegex);
        const token = authMatch && authMatch[1];

        if (token === null) {
            // We do not understand the credentials being provided at all (malformed)
            return res.status(401).json({});
        }

        jwt.verify(token, secret, (err, userId) => {
            if (err) {
                // We aknowledge a Bearer token was provided to us, but it is not valid
                return res.status(403).json({});
            }

            req.userId = userId;

            next();
        });
    };

    return db.init(path).then(async connection => {
        // Ready the express app
        const app = express().use(express.json());

        // Create http server
        const server = createServer(app);

        app.post('/api/login', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            // We expect a json body from the request, with 'name' and 'password' fields
            const name = req.body?.name || null;
            const password = req.body?.password || null;

            // Get a list of all existing worlds
            connection.manager.createQueryBuilder(User, 'user')
                .where('user.name = :name', {name}).getOne().then(user => {
                    if (user && user.password == db.hashPassword(password, user.salt)) {
                        // Provided password is matching
                        res.send({'id': user.id, 'token': jwt.sign(user.id, secret)});
                    } else {
                        // Invalid credentials provided: we cannot log this user in
                        res.status(403).json({});
                    }
            });
        });

        app.get('/api/worlds', authenticate, (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            // Get a list of all existing worlds
            connection.manager.createQueryBuilder(World, 'world').getMany().then(worlds => res.send(worlds));
        });

        app.get('/api/worlds/:id', authenticate, (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            // Get a single world using its id (return 404 if not found)
            connection.manager.createQueryBuilder(World, 'world')
                .where('world.id = :id', {id: req.params.id}).getOne().then(world => {
                    if (world) {
                        res.send(world);
                    } else {
                        res.status(404).json({});
                    }
                });
        });

        app.get('/api/worlds/:id/props', authenticate, (req, res) => {
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
                        res.status(404).json({});
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

        server.listen(port);

        return server
    });
};

export {spawnHttpServer};
