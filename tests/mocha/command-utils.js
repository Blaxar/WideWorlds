/**
 * @author Nekohime <https://github.com/Nekohime>
*/

import * as assert from 'assert';
import {parseCommand} from '../../client/src/core/command-utils.js';

// Testing user feed
describe('command-utils', () => {
  it('all', () => {
    let tpxyz = "/tp 5 0 5";
    assert.strictEqual(parseCommand(tpxyz).x, 5);
    assert.strictEqual(parseCommand(tpxyz).y, 0);
    assert.strictEqual(parseCommand(tpxyz).z, 5);

    // Should return undefined, as we don't handle this case yet.
    let tpxz = "/tp 5 5";
    assert.strictEqual(parseCommand(tpxz)?.x, undefined);
    assert.strictEqual(parseCommand(tpxz)?.z, undefined);
  });
});
