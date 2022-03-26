const db = require('../../common/db/utils');
const httpServer = require('../../server/http');
const World = require('../../common/db/model/World').World;
const Prop = require('../../common/db/model/Prop').Prop;
const User = require('../../common/db/model/User').User;
const request = require('supertest');
const assert = require('assert');
const fs = require('fs');
const getConnection = require('typeorm').getConnection;

const dbFile = 'mocha-http-test-db.sqlite3';

const makeTestWorld = async (connection, name, data) => {
    return (await connection.manager.save([new World(undefined, name, data)]))[0].id;
};

const makeTestUser = async (connection, name, password) => {
    return (await connection.manager.save([new User(undefined, name, password)]))[0].id;
};

const makeTestProp = async (connection, worldId, userId, date, x, y, z, yaw,
                      pitch, roll, name, description, action) => {
    return (await connection.manager.save([new Prop(undefined, worldId, userId, date, x, y, z,
                                                    yaw, pitch, roll, name, description,
                                                    action)]))[0].id;
};

// Testing http server
describe('http server', () => {
    let server = null;
    let connection = null;
    let worldId = null;
    let userId = 0;
    let now = 0;

    before(async () => {
        if (fs.existsSync(dbFile)) {
            throw("Test database file already exists, move it or delete it first.");
        }

        server = await httpServer(dbFile, 62931);
    });

    beforeEach(async () => {
        // Create world in database, get its ID back
        worldId = await makeTestWorld(getConnection(), 'Test World', '{}');

        now = Date.now();

        // Fill-in database with a few props belonging to the world right above
        await makeTestProp(getConnection(), worldId, userId, now, 0, 0, 0, 0, 0, 0,
                           'wall01.rwx', 'Some description.', 'create color red;');
        await makeTestProp(getConnection(), worldId, userId, now, 100, -200, 300, 450, 900, 1350,
                           'wall02.rwx', 'Some other description.', 'create color blue;');
    });

    afterEach(async () => {
        // Fetch all the entities
        const entities = getConnection().entityMetadatas;

        // Clear them all
        for (const entity of entities) {
            const repository = getConnection().getRepository(entity.name);
            await repository.clear();
        }
    });

    after(async () => {
        await server.close();
        fs.unlinkSync(dbFile);
    });

    it('GET /api/worlds', (done) => {
        request(server)
            .get('/api/worlds')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect('[{"id":1,"name":"Test World","data":"{}"}]')
            .expect(200, done);
    });

    it('GET /api/worlds/id/props', (done) => {
        request(server)
            .get('/api/worlds/' + worldId + '/props')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                // Get the body (json content) of the request
                const body = response.body;

                // We expect two entries
                assert.equal(body.length, 2);

                // Assert first prop fields
                assert.equal(body[0].worldId, worldId);
                assert.equal(body[0].userId, userId);
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
                assert.equal(body[1].userId, userId);
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

                // Success!
                done();
            })
            .catch(err => done(err))
    });

    it('GET /api/worlds/id/props with filters', (done) => {
        request(server)
            .get('/api/worlds/' + worldId + '/props?minX=50&maxX=150&minY=-240&maxY=-160&minZ=270&maxZ=330')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                // Get the body (json content) of the request
                const body = response.body;

                // We expect one single entry
                assert.equal(body.length, 1);

                // Assert prop fields
                assert.equal(body[0].worldId, worldId);
                assert.equal(body[0].userId, userId);
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

                // Success!
                done();
            })
            .catch(err => done(err))
    });
});
