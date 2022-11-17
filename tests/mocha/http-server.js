import makeHttpTestBase from '../utils.js';
import request from 'superwstest';
import * as assert from 'assert';

// Testing http server

describe('http server', () => {
    const ctx = makeHttpTestBase();
    const base = ctx.base;

    before(ctx.before);

    beforeEach(ctx.beforeEach);

    afterEach(ctx.afterEach);

    after(ctx.after);

    it('POST /api/login - OK', (done) => {
        request(base.server)
            .post('/api/login')
            .send({username: 'xXx_B0b_xXx', password: '3p1cP4sSw0Rd'})
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                assert.equal(body.id, base.adminId);
                assert.ok(body.token);

                done();
            })
            .catch(err => done(err));
    });

    it('POST /api/login - Unauthorized', (done) => {
        request(base.server)
            .post('/api/login')
            .send({username: 'xXx_B0b_xXx', password: 'UwU'})
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    // Testing World API

    it('GET /api/worlds - OK', (done) => {
        request(base.server)
            .get('/api/worlds')
            .set('Authorization', 'Bearer ' + base.adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                // We expect only one entry
                assert.equal(body.length, 1);

                assert.equal(body[0].id, base.worldId);
                assert.equal(body[0].name, 'Test World');
                assert.equal(body[0].data, '{}');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/worlds - Unauthorized', (done) => {
        request(base.server)
            .get('/api/worlds')
            .set('Authorization', 'gibberish')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    it('GET /api/worlds - Forbidden', (done) => {
        request(base.server)
            .get('/api/worlds')
            .set('Authorization', 'Bearer iNvAlId')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    it('GET /api/worlds/id - OK', (done) => {
        request(base.server)
            .get('/api/worlds/' + base.worldId)
            .set('Authorization', 'Bearer ' + base.adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                assert.equal(body.id, base.worldId);
                assert.equal(body.name, 'Test World');
                assert.equal(body.data, '{}');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/worlds/id - Unauthorized', (done) => {
        request(base.server)
            .get('/api/worlds/' + base.worldId)
            .set('Authorization', 'gibberish')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    it('GET /api/worlds/id - Forbidden', (done) => {
        request(base.server)
            .get('/api/worlds/' + base.worldId)
            .set('Authorization', 'Bearer iNvAlId')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    it('GET /api/worlds/id - Not found', (done) => {
        request(base.server)
            .get('/api/worlds/66666')
            .set('Authorization', 'Bearer ' + base.adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404, done);
    });

    // Testing Prop API

    it('GET /api/worlds/id/props - OK', (done) => {
        request(base.server)
            .get('/api/worlds/' + base.worldId + '/props')
            .set('Authorization', 'Bearer ' + base.adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                // Get the body (json content) of the request
                const body = response.body;

                // We expect two entries
                assert.equal(body.length, 2);

                // Assert first prop fields
                assert.equal(body[0].worldId, base.worldId);
                assert.equal(body[0].userId, base.adminId);
                assert.equal(body[0].date, base.now);
                assert.equal(body[0].x, 0);
                assert.equal(body[0].y, 0);
                assert.equal(body[0].z, 0);
                assert.equal(body[0].yaw, 0);
                assert.equal(body[0].pitch, 0);
                assert.equal(body[0].roll, 0);
                assert.equal(body[0].name, 'wall01.rwx');
                assert.equal(body[0].description, 'Some description.');
                assert.equal(body[0].action, 'create color red;');

                // Assert second prop fields
                assert.equal(body[1].worldId, base.worldId);
                assert.equal(body[1].userId, base.adminId);
                assert.equal(body[1].date, base.now);
                assert.equal(body[1].x, 100);
                assert.equal(body[1].y, -200);
                assert.equal(body[1].z, 300);
                assert.equal(body[1].yaw, 450);
                assert.equal(body[1].pitch, 900);
                assert.equal(body[1].roll, 1350);
                assert.equal(body[1].name, 'wall02.rwx');
                assert.equal(body[1].description, 'Some other description.');
                assert.equal(body[1].action, 'create color blue;');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/worlds/id/props with filters - OK', (done) => {
        request(base.server)
            .get('/api/worlds/' + base.worldId + '/props?minX=50&maxX=150&minY=-240&maxY=-160&minZ=270&maxZ=330')
            .set('Authorization', 'Bearer ' + base.adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                // Get the body (json content) of the request
                const body = response.body;

                // We expect one single entry
                assert.equal(body.length, 1);

                // Assert prop fields
                assert.equal(body[0].worldId, base.worldId);
                assert.equal(body[0].userId, base.adminId);
                assert.equal(body[0].date, base.now);
                assert.equal(body[0].x, 100);
                assert.equal(body[0].y, -200);
                assert.equal(body[0].z, 300);
                assert.equal(body[0].yaw, 450);
                assert.equal(body[0].pitch, 900);
                assert.equal(body[0].roll, 1350);
                assert.equal(body[0].name, 'wall02.rwx');
                assert.equal(body[0].description, 'Some other description.');
                assert.equal(body[0].action, 'create color blue;');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/worlds/id/props with filters - Bad Request', (done) => {
        request(base.server)
            .get('/api/worlds/' + base.worldId + '/props?minX=sdgdsgsdg&maxX=150&minY=-240&maxY=-160&minZ=270&maxZ=330')
            .set('Authorization', 'Bearer ' + base.adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400, done);
    });

    it('GET /api/worlds/id/props - Unauthorized', (done) => {
        request(base.server)
            .get('/api/worlds/' + base.worldId + '/props')
            .set('Authorization', 'gibberish')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    it('GET /api/worlds/id/props - Forbidden', (done) => {
        request(base.server)
            .get('/api/worlds/' + base.worldId + '/props')
            .set('Authorization', 'Bearer iNvAlId')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    it('GET /api/worlds/id/props - Not found', (done) => {
        request(base.server)
            .get('/api/worlds/66666/props')
            .set('Authorization', 'Bearer ' + base.adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404, done);
    });

    // Testing User API (as admin)

    it('GET /api/users (as admin) - OK (all)', (done) => {
        request(base.server)
            .get('/api/users')
            .set('Authorization', 'Bearer ' + base.adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                // We expect only one entry
                assert.equal(body.length, 2);

                assert.equal(body[0].id, base.adminId);
                assert.equal(body[0].name, 'xXx_B0b_xXx');
                assert.equal(body[0].email, 'test@somemail.com');
                assert.equal(body[0].role, 'admin');

                assert.equal(body[1].id, base.citizenId);
                assert.equal(body[1].name, 'oOo_Al1ce_oOo');
                assert.equal(body[1].email, 'test2@somemail.com');
                assert.equal(body[1].role, 'citizen');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/users (as admin) - OK (first page)', (done) => {
        request(base.server)
            .get('/api/users?amount=1')
            .set('Authorization', 'Bearer ' + base.adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                // We expect only one entry
                assert.equal(body.length, 1);

                assert.equal(body[0].id, base.adminId);
                assert.equal(body[0].name, 'xXx_B0b_xXx');
                assert.equal(body[0].email, 'test@somemail.com');
                assert.equal(body[0].role, 'admin');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/users (as admin) - OK (second page)', (done) => {
        request(base.server)
            .get('/api/users?amount=1&page=1')
            .set('Authorization', 'Bearer ' + base.adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                // We expect only one entry
                assert.equal(body.length, 1);

                assert.equal(body[0].id, base.citizenId);
                assert.equal(body[0].name, 'oOo_Al1ce_oOo');
                assert.equal(body[0].email, 'test2@somemail.com');
                assert.equal(body[0].role, 'citizen');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/users (as admin) - Bad Request', (done) => {
        request(base.server)
            .get('/api/users?amount=-1000000')
            .set('Authorization', 'Bearer ' + base.adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400, done);
    });

    it('GET /api/users (as admin) - Unauthorized', (done) => {
        request(base.server)
            .get('/api/users')
            .set('Authorization', 'gibberish')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    it('GET /api/users (as admin) - Forbidden', (done) => {
        request(base.server)
            .get('/api/users')
            .set('Authorization', 'Bearer iNvAlId')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    it('GET /api/users/id (as admin) - OK (self)', (done) => {
        request(base.server)
            .get('/api/users/' + base.adminId)
            .set('Authorization', 'Bearer ' + base.adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                assert.equal(body.id, base.adminId);
                assert.equal(body.name, 'xXx_B0b_xXx');
                assert.equal(body.email, 'test@somemail.com');
                assert.equal(body.role, 'admin');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/users/id (as admin) - OK (someone else)', (done) => {
        request(base.server)
            .get('/api/users/' + base.citizenId)
            .set('Authorization', 'Bearer ' + base.adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                assert.equal(body.id, base.citizenId);
                assert.equal(body.name, 'oOo_Al1ce_oOo');
                assert.equal(body.email, 'test2@somemail.com');
                assert.equal(body.role, 'citizen');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/users/id (as admin) - Unauthorized', (done) => {
        request(base.server)
            .get('/api/users/' + base.adminId)
            .set('Authorization', 'gibberish')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    it('GET /api/users/id (as admin) - Forbidden', (done) => {
        request(base.server)
            .get('/api/users/' + base.adminId)
            .set('Authorization', 'Bearer iNvAlId')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    it('GET /api/users/id (as admin) - Not found', (done) => {
        request(base.server)
            .get('/api/users/66666')
            .set('Authorization', 'Bearer ' + base.adminBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404, done);
    });

    // Testing User API (as citizen)

    it('GET /api/users (as citizen) - Forbidden (low rank)', (done) => {
        request(base.server)
            .get('/api/users')
            .set('Authorization', 'Bearer ' + base.citizenBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    it('GET /api/users (as citizen) - Unauthorized', (done) => {
        request(base.server)
            .get('/api/users')
            .set('Authorization', 'gibberish')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    it('GET /api/users (as citizen) - Forbidden', (done) => {
        request(base.server)
            .get('/api/users')
            .set('Authorization', 'Bearer iNvAlId')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    it('GET /api/users/id (as citizen) - OK (self)', (done) => {
        request(base.server)
            .get('/api/users/' + base.citizenId)
            .set('Authorization', 'Bearer ' + base.citizenBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200).then(response => {
                const body = response.body;

                assert.equal(body.id, base.citizenId);
                assert.equal(body.name, 'oOo_Al1ce_oOo');
                assert.equal(body.email, 'test2@somemail.com');
                assert.equal(body.role, 'citizen');

                done();
            })
            .catch(err => done(err));
    });

    it('GET /api/users/id (as citizen) - Forbidden (someone else)', (done) => {
        request(base.server)
            .get('/api/users/' + base.adminId)
            .set('Authorization', 'Bearer ' + base.citizenBearerToken)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });

    it('GET /api/users/id (as citizen) - Unauthorized', (done) => {
        request(base.server)
            .get('/api/users/' + base.citizenId)
            .set('Authorization', 'gibberish')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401, done);
    });

    it('GET /api/users/id (as citizen) - Forbidden', (done) => {
        request(base.server)
            .get('/api/users/' + base.citizenId)
            .set('Authorization', 'Bearer iNvAlId')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403, done);
    });
});
