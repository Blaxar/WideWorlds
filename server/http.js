import * as db from '../common/db/utils.js';
import World from '../common/db/model/World.js';
import Prop from '../common/db/model/Prop.js';
import User from '../common/db/model/User.js';
import {roleLevels, hasUserRole, hasUserIdInParams, middleOr, middleAnd, forbiddenOnFalse} from './utils.js';
import {createServer} from 'http';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';

const bearerRegex = /^Bearer (.*)$/i;

const minNbUsersPerPage = 1;
const defaultNbUsersPerPage = 200;
const maxNbUsersPerPage = defaultNbUsersPerPage*10;

const spawnHttpServer = async (path, port, secret) => {
    const authenticate = (req, res, next) => {
        // Get Bearer token, we strip the 'Bearer' part
        const authMatch = req.headers['authorization']?.match(bearerRegex);
        const token = authMatch && authMatch[1];

        if (token === null) {
            // We do not understand the credentials being provided at all (malformed)
            return res.status(401).json({});
        }

        jwt.verify(token, secret, (err, payload) => {
            if (err) {
                // We aknowledge a Bearer token was provided to us, but it is not valid
                return res.status(403).json({});
            }

            req.userId = payload.userId;
            req.userRole = payload.userRole;

            next();
        });
    };

    return db.init(path).then(async connection => {
        // Ready the express app
        const app = express().use(express.json()).use(cors());

        // Create http server
        const server = createServer(app);

        app.post('/api/login', (req, res) => {
            res.setHeader('Content-Type', 'application/json');

            // We expect a json body from the request, with 'name' and 'password' fields
            const name = req.body?.name || null;
            const password = req.body?.password || null;

            // Find user matching provided credentials (if any)
            connection.manager.createQueryBuilder(User, 'user')
                .where('user.name = :name', {name}).getOne().then(user => {
                    if (user && user.password == db.hashPassword(password, user.salt)) {
                        // Provided password is matching
                        res.send({'id': user.id, 'role': user.role, 'token': jwt.sign({userId: user.id, userRole: user.role}, secret)});
                    } else {
                        // Invalid credentials provided: we cannot log this user in
                        res.status(403).json({});
                    }
                })
                .catch(err => res.status(500).json({}));
        });

        app.get('/api/worlds', authenticate, (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            // Get a list of all existing worlds
            connection.manager.createQueryBuilder(World, 'world').getMany().then(worlds => res.send(worlds))
            .catch(err => res.status(500).json({}));
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
                })
                .catch(err => res.status(500).json({}));
        });

        app.get('/api/worlds/:id/props', authenticate, (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            const wid = req.params.id

            let minX = req.query.minX
            let maxX = req.query.maxX
            let minY = req.query.minY
            let maxY = req.query.maxY
            let minZ = req.query.minZ
            let maxZ = req.query.maxZ

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
                            minX = parseInt(minX)

                            if (!isFinite(minX)) {
                                res.status(400).json({});
                                return;
                            }

                            queryBuilder.andWhere('prop.x >= :minX', {minX});
                        }

                        if (maxX) {
                            maxX = parseInt(maxX)

                            if (!isFinite(maxX)) {
                                res.status(400).json({});
                                return;
                            }

                            queryBuilder.andWhere('prop.x < :maxX', {maxX});
                        }

                        if (minY) {
                            minY = parseInt(minY)

                            if (!isFinite(minY)) {
                                res.status(400).json({});
                                return;
                            }

                            queryBuilder.andWhere('prop.y >= :minY', {minY});
                        }

                        if (maxY) {
                            maxY = parseInt(maxY)

                            if (!isFinite(maxY)) {
                                res.status(400).json({});
                                return;
                            }

                            queryBuilder.andWhere('prop.y < :maxY', {maxY});
                        }

                        if (minZ) {
                            minZ = parseInt(minZ)

                            if (!isFinite(minZ)) {
                                res.status(400).json({});
                                return;
                            }

                            queryBuilder.andWhere('prop.z >= :minZ', {minZ});
                        }

                        if (maxZ) {
                            maxZ = parseInt(maxZ)

                            if (!isFinite(maxZ)) {
                                res.status(400).json({});
                                return;
                            }

                            queryBuilder.andWhere('prop.z < :maxZ', {maxZ});
                        }

                        // Respond with list of props
                        queryBuilder.getMany().then(props => res.send(props));
                    }
                })
                .catch(err => res.status(500).json({}));
        });

        app.get('/api/users', authenticate, forbiddenOnFalse(hasUserRole('admin')), (req, res) => {
            res.setHeader('Content-Type', 'application/json');

            // Fetch pagination info from query parameters (if any)
            const page = req.query.page ? parseInt(req.query.page) : 0;
            const amount = req.query.amount ? parseInt(req.query.amount) : defaultNbUsersPerPage;

            if (!isFinite(page) || !isFinite(amount) || amount > maxNbUsersPerPage || amount < minNbUsersPerPage || page < 0) {
                res.status(400).json({});
                return;
            }

            // Get a list of all existing users
            connection.manager.createQueryBuilder(User, 'user').skip(page*amount).take(amount).getMany().then(users =>
                res.send(users.map(user => (({id, name, email, role}) => ({id, name, email, role}))(user)))
            )
            .catch(err => res.status(500).json({}));
        });

        app.get('/api/users/:id', authenticate, forbiddenOnFalse(middleOr(hasUserRole('admin'), hasUserIdInParams('id'))), (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            // Get a single user using their id (return 404 if not found)
            connection.manager.createQueryBuilder(User, 'user')
                .where('user.id = :id', {id: req.params.id}).getOne().then(user => {
                    if (user) {
                        res.send(JSON.stringify(user, ['id', 'name', 'email', 'role']));
                    } else {
                        res.status(404).json({});
                    }
                })
                .catch(err => res.status(500).json({}));
        });

        server.listen(port);

        return server
    });
};

export {spawnHttpServer};
