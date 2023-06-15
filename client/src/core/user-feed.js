/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

const userFeedPriority = {
  debug: 0,
  info: 1,
  message: 2,
  warning: 3,
  error: 4,
  critical: 5,
};

/**
 * Simple user feed class, to input chat messages and various
 * log entries
 */
class UserFeed {
  /**
   * @constructor
   */
  constructor() {
    this.listeners = [];
  }

  /**
   * Register listener to the feed
   * @param {function} cb - Listener callback function.
   * @return {integer} Handle of the newly-added listener.
   */
  addListener(cb) {
    let id = null;

    this.listeners.forEach((entry, key) => {
      if (!entry) {
        this.listeners[key] = cb;
        id = key;
      }
    });

    if (id !== null) return id;

    id = this.listeners.length;
    this.listeners.push(cb);
    return id;
  }

  /**
   * Unregister listener from the feed
   * @param {integer} id - Handle of the newly-added listener.
   * @return {boolean} True if the listener was removed, false if
   *                   this handle didn't match anything.
   */
  removeListener(id) {
    if (id >= this.listeners.length || !this.listeners[id]) {
      return false;
    }

    this.listeners[id] = null;
    return true;
  }

  /**
   * Publish entry to the feed
   * @param {string} entry - String to publish to the feed.
   * @param {string} emitter - Name of the emitetr (if any).
   * @param {userFeedPriority} priority - Priority of this entry.
   */
  publish(entry, emitter = null, priority = userFeedPriority.message) {
    for (const cb of this.listeners) {
      if (cb) cb(entry, emitter, priority);
    }
  }
}

export default UserFeed;
export {userFeedPriority};
