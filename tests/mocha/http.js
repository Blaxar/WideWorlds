import * as db from '../../common/db/utils.js';
import {spawnHttpServer} from '../../server/http.js';
import {spawnWsServer} from '../../server/ws.js';
import World from '../../common/db/model/World.js';
import Prop from '../../common/db/model/Prop.js';
import User from '../../common/db/model/User.js';
import request from 'superwstest';
import * as assert from 'assert';
import * as fs from 'fs';
import * as crypto from 'crypto';
import TypeORM from 'typeorm';

const dbFile = 'mocha-http-test-db.sqlite3';
const secret = crypto.randomBytes(64).toString('hex');

const makeTestWorld = async (connection, name, data) => {
    return (await connection.manager.save([new World(undefined, name, data)]))[0].id;
};

const makeTestUser = async (connection, name, password, email, role) => {
    const salt = crypto.randomBytes(db.saltLength).toString('base64');

    const user = new User(undefined, name, db.hashPassword(password, salt), email, role, salt);
    return (await connection.manager.save([user]))[0].id;
};

const makeTestProp = async (connection, worldId, userId, date, x, y, z, yaw,
                      pitch, roll, name, description, action) => {
    return (await connection.manager.save([new Prop(undefined, worldId, userId, date, x, y, z,
                                                    yaw, pitch, roll, name, description,
                                                    action)]))[0].id;
};

// Testing http server
describe('http and ws servers', () => {
    let server = null;
    let wss = null;
    let connection = null;
    let worldId = null;
    let adminId = 0;
    let citizenId = 0;
    let now = 0;
    let adminBearerToken = '';
    let citizenBearerToken = '';

    before(async () => {
        if (fs.existsSync(dbFile)) {
            throw("Test database file already exists, move it or delete it first.");
        }

        server = await spawnHttpServer(dbFile, 62931, secret);
        wss = await spawnWsServer(server, secret);
    });

    beforeEach(async () => {
        // Create world in database, get its ID back
        worldId = await makeTestWorld(TypeORM.getConnection(), 'Test World', '{}');

        // Create users in database, get their IDs back
        adminId = await makeTestUser(TypeORM.getConnection(), 'xXx_B0b_xXx', '3p1cP4sSw0Rd', 'test@somemail.com', 'admin');
        citizenId = await makeTestUser(TypeORM.getConnection(), 'oOo_Al1ce_oOo', '3p1cP4sSw0Rd', 'test2@somemail.com', 'citizen');

        adminBearerToken = await request(server)
            .post('/api/login')
            .send({username: 'xXx_B0b_xXx', password: '3p1cP4sSw0Rd'})
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(async response => {
                const body = response.body;

                assert.equal(body.id, adminId);
                assert.ok(body.token);
                return body.token;
            });

        citizenBearerToken = await request(server)
            .post('/api/login')
            .send({username: 'oOo_Al1ce_oOo', password: '3p1cP4sSw0Rd'})
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(async response => {
                const body = response.body;

                assert.equal(body.id, citizenId);
                assert.ok(body.token);
                return body.token;
            });

        now = Date.now();

        // Fill-in database with a few props belonging to the world right above
        await makeTestProp(TypeORM.getConnection(), worldId, adminId, now, 0, 0, 0, 0, 0, 0,
                           'wall01.rwx', 'Some description.', 'create color red;');
        await makeTestProp(TypeORM.getConnection(), worldId, adminId, now, 100, -200, 300, 450, 900, 1350,
                           'wall02.rwx', 'Some other description.', 'create color blue;');
    });

    afterEach(async () => {
        // Fetch all the entities
        const entities = TypeORM.getConnection().entityMetadatas;

        // Clear them all
        for (const entity of entities) {
            const repository = TypeORM.getConnection().getRepository(entity.name);
            await repository.clear();
        }
    });

    after(async () => {
        await server.close();
        fs.unlinkSync(dbFile);
    });

    it('POST /api/login - OK', (done) => {
        request(server)
            .post('/api/login')
            .send({username: 'xXx_B0b_xXx', password: '3p1cP4sSw0Rd'})
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                assert.equal(body.id, adminId);
                assert.ok(body.token);

                done();
            })
            .catch(err => done(err));
    });

    it('POST /api/login - Unauthorized', (done) => {
        request(server)
            .post('/api/login')
            .send({username: 'xXx_B0b_xXx', password: 'UwU'})
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    // Testing World API

    it('GET /api/worlds - OK', (done) => {
        request(server)
            .get('/api/worlds')
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                // We expect only one entry
                assert.equal(body.length, 1);

                assert.equal(body[0].id, worldId);
                assert.equal(body[0].name, 'Test World');
                assert.equal(body[0].data, '{}');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/worlds - Unauthorized', (done) => {
        request(server)
            .get('/api/worlds')
            .set('Authorization', 'gibberish')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    it('GET /api/worlds - Forbidden', (done) => {
        request(server)
            .get('/api/worlds')
            .set('Authorization', 'Bearer iNvAlId')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    it('GET /api/worlds/id - OK', (done) => {
        request(server)
            .get('/api/worlds/' + worldId)
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                assert.equal(body.id, worldId);
                assert.equal(body.name, 'Test World');
                assert.equal(body.data, '{}');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/worlds/id - Unauthorized', (done) => {
        request(server)
            .get('/api/worlds/' + worldId)
            .set('Authorization', 'gibberish')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    it('GET /api/worlds/id - Forbidden', (done) => {
        request(server)
            .get('/api/worlds/' + worldId)
            .set('Authorization', 'Bearer iNvAlId')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    it('GET /api/worlds/id - Not found', (done) => {
        request(server)
            .get('/api/worlds/66666')
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404, done);
    });

    // Testing Prop API

    it('GET /api/worlds/id/props - OK', (done) => {
        request(server)
            .get('/api/worlds/' + worldId + '/props')
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                // Get the body (json content) of the request
                const body = response.body;

                // We expect two entries
                assert.equal(body.length, 2);

                // Assert first prop fields
                assert.equal(body[0].worldId, worldId);
                assert.equal(body[0].userId, adminId);
                assert.equal(body[0].date, now);
                assert.equal(body[0].x, 0);
                assert.equal(body[0].y, 0);
                assert.equal(body[0].z, 0);
                assert.equal(body[0].yaw, 0);
                assert.equal(body[0].pitch, 0);
                assert.equal(body[0].roll, 0);
                assert.equal(body[0].name, 'wall01.rwx')
                assert.equal(body[0].description, 'Some description.')
                assert.equal(body[0].action, 'create color red;');

                // Assert second prop fields
                assert.equal(body[1].worldId, worldId);
                assert.equal(body[1].userId, adminId);
                assert.equal(body[1].date, now);
                assert.equal(body[1].x, 100);
                assert.equal(body[1].y, -200);
                assert.equal(body[1].z, 300);
                assert.equal(body[1].yaw, 450);
                assert.equal(body[1].pitch, 900);
                assert.equal(body[1].roll, 1350);
                assert.equal(body[1].name, 'wall02.rwx')
                assert.equal(body[1].description, 'Some other description.')
                assert.equal(body[1].action, 'create color blue;');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/worlds/id/props with filters - OK', (done) => {
        request(server)
            .get('/api/worlds/' + worldId + '/props?minX=50&maxX=150&minY=-240&maxY=-160&minZ=270&maxZ=330')
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                // Get the body (json content) of the request
                const body = response.body;

                // We expect one single entry
                assert.equal(body.length, 1);

                // Assert prop fields
                assert.equal(body[0].worldId, worldId);
                assert.equal(body[0].userId, adminId);
                assert.equal(body[0].date, now);
                assert.equal(body[0].x, 100);
                assert.equal(body[0].y, -200);
                assert.equal(body[0].z, 300);
                assert.equal(body[0].yaw, 450);
                assert.equal(body[0].pitch, 900);
                assert.equal(body[0].roll, 1350);
                assert.equal(body[0].name, 'wall02.rwx')
                assert.equal(body[0].description, 'Some other description.')
                assert.equal(body[0].action, 'create color blue;');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/worlds/id/props with filters - Bad Request', (done) => {
        request(server)
            .get('/api/worlds/' + worldId + '/props?minX=sdgdsgsdg&maxX=150&minY=-240&maxY=-160&minZ=270&maxZ=330')
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400, done);
    });

    it('GET /api/worlds/id/props - Unauthorized', (done) => {
        request(server)
            .get('/api/worlds/' + worldId + '/props')
            .set('Authorization', 'gibberish')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    it('GET /api/worlds/id/props - Forbidden', (done) => {
        request(server)
            .get('/api/worlds/' + worldId + '/props')
            .set('Authorization', 'Bearer iNvAlId')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    it('GET /api/worlds/id/props - Not found', (done) => {
        request(server)
            .get('/api/worlds/66666/props')
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404, done);
    });

    // Testing User API (as admin)

    it('GET /api/users (as admin) - OK (all)', (done) => {
        request(server)
            .get('/api/users')
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                // We expect only one entry
                assert.equal(body.length, 2);

                assert.equal(body[0].id, adminId);
                assert.equal(body[0].name, 'xXx_B0b_xXx');
                assert.equal(body[0].email, 'test@somemail.com');
                assert.equal(body[0].role, 'admin');

                assert.equal(body[1].id, citizenId);
                assert.equal(body[1].name, 'oOo_Al1ce_oOo');
                assert.equal(body[1].email, 'test2@somemail.com');
                assert.equal(body[1].role, 'citizen');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/users (as admin) - OK (first page)', (done) => {
        request(server)
            .get('/api/users?amount=1')
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                // We expect only one entry
                assert.equal(body.length, 1);

                assert.equal(body[0].id, adminId);
                assert.equal(body[0].name, 'xXx_B0b_xXx');
                assert.equal(body[0].email, 'test@somemail.com');
                assert.equal(body[0].role, 'admin');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/users (as admin) - OK (second page)', (done) => {
        request(server)
            .get('/api/users?amount=1&page=1')
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                // We expect only one entry
                assert.equal(body.length, 1);

                assert.equal(body[0].id, citizenId);
                assert.equal(body[0].name, 'oOo_Al1ce_oOo');
                assert.equal(body[0].email, 'test2@somemail.com');
                assert.equal(body[0].role, 'citizen');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/users (as admin) - Bad Request', (done) => {
        request(server)
            .get('/api/users?amount=-1000000')
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400, done);
    });

    it('GET /api/users (as admin) - Unauthorized', (done) => {
        request(server)
            .get('/api/users')
            .set('Authorization', 'gibberish')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    it('GET /api/users (as admin) - Forbidden', (done) => {
        request(server)
            .get('/api/users')
            .set('Authorization', 'Bearer iNvAlId')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    it('GET /api/users/id (as admin) - OK (self)', (done) => {
        request(server)
            .get('/api/users/' + adminId)
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                assert.equal(body.id, adminId);
                assert.equal(body.name, 'xXx_B0b_xXx');
                assert.equal(body.email, 'test@somemail.com');
                assert.equal(body.role, 'admin');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/users/id (as admin) - OK (someone else)', (done) => {
        request(server)
            .get('/api/users/' + citizenId)
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                assert.equal(body.id, citizenId);
                assert.equal(body.name, 'oOo_Al1ce_oOo');
                assert.equal(body.email, 'test2@somemail.com');
                assert.equal(body.role, 'citizen');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/users/id (as admin) - Unauthorized', (done) => {
        request(server)
            .get('/api/users/' + adminId)
            .set('Authorization', 'gibberish')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    it('GET /api/users/id (as admin) - Forbidden', (done) => {
        request(server)
            .get('/api/users/' + adminId)
            .set('Authorization', 'Bearer iNvAlId')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    it('GET /api/users/id (as admin) - Not found', (done) => {
        request(server)
            .get('/api/users/66666')
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404, done);
    });

    // Testing User API (as citizen)

    it('GET /api/users (as citizen) - Forbidden (low rank)', (done) => {
        request(server)
            .get('/api/users')
            .set('Authorization', 'Bearer ' + citizenBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    it('GET /api/users (as citizen) - Unauthorized', (done) => {
        request(server)
            .get('/api/users')
            .set('Authorization', 'gibberish')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    it('GET /api/users (as citizen) - Forbidden', (done) => {
        request(server)
            .get('/api/users')
            .set('Authorization', 'Bearer iNvAlId')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    it('GET /api/users/id (as citizen) - OK (self)', (done) => {
        request(server)
            .get('/api/users/' + citizenId)
            .set('Authorization', 'Bearer ' + citizenBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                assert.equal(body.id, citizenId);
                assert.equal(body.name, 'oOo_Al1ce_oOo');
                assert.equal(body.email, 'test2@somemail.com');
                assert.equal(body.role, 'citizen');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/users/id (as citizen) - Forbidden (someone else)', (done) => {
        request(server)
            .get('/api/users/' + adminId)
            .set('Authorization', 'Bearer ' + citizenBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);;
    });

    it('GET /api/users/id (as citizen) - Unauthorized', (done) => {
        request(server)
            .get('/api/users/' + citizenId)
            .set('Authorization', 'gibberish')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    it('GET /api/users/id (as citizen) - Forbidden', (done) => {
        request(server)
            .get('/api/users/' + citizenId)
            .set('Authorization', 'Bearer iNvAlId')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    // Testing websockets

    it('WS connect - OK', async () => {
        await request(server).ws('/ws')
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .sendText('What is my id?')
            .expectText(`${adminId}`)
            .sendText('What is up my dude?')
            .expectText('???')
            .close()
            .expectClosed();
    });

    it('WS connect - Unauthorized', async () => {
        await request(server).ws('/ws')
            .set('Authorization', 'gibberish')
            .expectConnectionError(401);
    });

    it('WS connect - Forbidden', async () => {
        await request(server).ws('/ws')
            .set('Authorization', 'Bearer iNvAlId')
            .expectConnectionError(403);
    });

    it('WS world chat connect - OK', async () => {
        await request(server).ws('/api/worlds/' + worldId + '/ws/chat')
            .set('Authorization', 'Bearer ' + adminBearerToken)
            .sendText('What is up my dude?')
            .expectText('What is up my dude?')
            .close()
            .expectClosed();
    });

    it('WS world chat connect - Unauthorized', async () => {
        await request(server).ws('/api/worlds/' + worldId + '/ws/chat')
            .set('Authorization', 'gibberish')
            .expectConnectionError(401);
    });

    it('WS world chat connect - Forbidden', async () => {
        await request(server).ws('/api/worlds/' + worldId + '/ws/chat')
            .set('Authorization', 'Bearer iNvAlId')
            .expectConnectionError(403);
    });
});
