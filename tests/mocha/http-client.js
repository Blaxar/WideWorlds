import makeHttpTestBase from '../utils.js';
import HttpClient from '../../client/src/core/http-client.js';
import * as assert from 'assert';

// Testing http client
describe('http client', () => {
    const ctx = makeHttpTestBase();
    const base = ctx.base;

    const httpClient = new HttpClient('http://127.0.0.1:' + base.port + '/api', true);

    before(ctx.before);

    beforeEach(ctx.beforeEach);

    afterEach(async () => {
        await ctx.afterEach();
        httpClient.clear();
    });

    after(ctx.after);

    const login = async () => await httpClient.login('xXx_B0b_xXx', '3p1cP4sSw0Rd');

    it('login - OK', (done) => {
        login().then(() => done())
            .catch(err => done(err));
    });

    it('login - Unauthorized', (done) => {
        httpClient.login('xXx_B0b_xXx', 'UwU')
            .then(() => done('Login should not work here'))
            .catch(err => {
                if(err == 401) done();
                else done(err);
            });
    });

    // Testing World API

    it('GET /api/worlds - OK', (done) => {
        login().then(() => {
        httpClient.getWorlds()
            .then(body => {
                // We expect only one entry
                assert.equal(body.length, 1);

                assert.equal(body[0].id, base.worldId);
                assert.equal(body[0].name, 'Test World');
                assert.equal(body[0].data, '{}');

                done();
            })})
            .catch(err => done(err));
    });

    it('GET /api/worlds - Unauthorized', (done) => {
        httpClient.getWorlds()
            .then(() => done('Getting worlds should not work here'))
            .catch(err => {
                if(err == 401) done();
                else done(err);
            });
    });
});
