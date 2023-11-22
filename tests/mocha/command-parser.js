/**
 * @author Nekohime <https://github.com/Nekohime>
 */

import * as assert from 'assert';
import CommandParser from '../../client/src/core/command-parser.js';
import Engine3D from '../../client/src/core/engine-3d.js';

// Testing user feed
describe('command-parser', () => {
  it('all', () => {
    const parser = new CommandParser();
    assert.strictEqual(parser.isCommand('/tp'), true);
    assert.strictEqual(parser.isCommand('/'), false);
    assert.strictEqual(parser.isCommand('//'), false);
    assert.strictEqual(parser.isCommand('/notrealbutshouldbetrue'), true);
    assert.strictEqual(parser.isCommand('//notarealcommand'), false);
  });
});
