/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import * as assert from 'assert';
import UserFeed, {userFeedPriority} from '../../client/src/core/user-feed.js';

// Testing user feed
describe('user-feed', () => {
  it('all', () => {
    let msgPriority1;
    let msgEmitter1;
    let msgEntry1;
    let msgPriority2;
    let msgEmitter2;
    let msgEntry2;

    const cb1 = (entry, emitter, priority) => {
      msgPriority1 = priority;
      msgEmitter1 = emitter;
      msgEntry1 = entry;
    };

    const cb2 = (entry, emitter, priority) => {
      msgPriority2 = priority;
      msgEmitter2 = emitter;
      msgEntry2 = entry;
    };

    const feed = new UserFeed();
    assert.strictEqual(feed.addListener(cb1), 0);
    assert.strictEqual(feed.addListener(cb2), 1);
    feed.publish('Some message here!');

    assert.strictEqual(msgPriority1, userFeedPriority.message);
    assert.strictEqual(msgEmitter1, null);
    assert.strictEqual(msgEntry1, 'Some message here!');
    assert.strictEqual(msgPriority2, userFeedPriority.message);
    assert.strictEqual(msgEmitter2, null);
    assert.strictEqual(msgEntry2, 'Some message here!');

    // Testing listener removal
    assert.ok(!feed.removeListener(666)); // Listener does not exist
    assert.ok(feed.removeListener(0)); // Remove first listener
    assert.ok(!feed.removeListener(0)); // Listener already removed

    feed.publish('Some other message there.', 'system', userFeedPriority.warning);

    // The first callback should not have been called
    assert.strictEqual(msgPriority1, userFeedPriority.message);
    assert.strictEqual(msgEmitter1, null);
    assert.strictEqual(msgEntry1, 'Some message here!');

    // The second should have
    assert.strictEqual(msgPriority2, userFeedPriority.warning);
    assert.strictEqual(msgEmitter2, 'system');
    assert.strictEqual(msgEntry2, 'Some other message there.');

    // Previous handle should be reused when registering new
    // listener
    assert.strictEqual(feed.addListener(cb1), 0);
    feed.publish('Ok, we are done.', 'Duke', userFeedPriority.info);

    assert.strictEqual(msgPriority1, userFeedPriority.info);
    assert.strictEqual(msgEmitter1, 'Duke');
    assert.strictEqual(msgEntry1, 'Ok, we are done.');
    assert.strictEqual(msgPriority2, userFeedPriority.info);
    assert.strictEqual(msgEmitter2, 'Duke');
    assert.strictEqual(msgEntry2, 'Ok, we are done.');
  });
});
