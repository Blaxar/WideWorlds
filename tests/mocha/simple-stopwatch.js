/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {sleep, epsEqual} from '../utils.js';
import * as assert from 'assert';
import SimpleStopwatch from '../../common/simple-stopwatch.js';

// Testing SimpleStopwatch utility
describe('SimpleStopwatch', () => {
  it('usage', async () => {
    const simpleStopwatch = new SimpleStopwatch();

    let entries = simpleStopwatch.check();

    // Not expecting any initial entry
    assert.equal(entries.length, 0);

    await sleep(50);
    const firstDuration = simpleStopwatch.clock('first');

    await sleep(100);
    const secondDuration = simpleStopwatch.clock('second');

    await sleep(150);
    const thirdDuration = simpleStopwatch.clock('third');

    entries = simpleStopwatch.check();
    assert.equal(entries.length, 3);

    // We take wide margins for the duration equality assertion
    // to accomodate for potential runtime slowness, as sleeping
    // is seldom lasting the exact specified amount of time
    // (usually lasting a bit more)
    const sleepMarginMs = 5;

    assert.equal(entries[0][0], 'first');
    assert.equal(entries[0][1], firstDuration);
    assert.ok(epsEqual(firstDuration, 50, sleepMarginMs));

    assert.equal(entries[1][0], 'second');
    assert.equal(entries[1][1], secondDuration);
    assert.ok(epsEqual(secondDuration, 100, sleepMarginMs));

    assert.equal(entries[2][0], 'third');
    assert.equal(entries[2][1], thirdDuration);
    assert.ok(epsEqual(thirdDuration, 150, sleepMarginMs));
  });
});
