/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

/**
 * Simple stopwatch utility to mesure the elapsed time each
 * clocked step takes
 */
class SimpleStopwatch {
  /** @constructor */
  constructor() {
    this.entries = [];
    this.lastTick = Date.now();
  }

  /**
   * Start a new session (and stop the previous one if any)
   * @return {Array} Recorded entries since last time this
   *                 method was called, each entry is a tuple
   *                 holding a step name and its associated
   *                 duration (in milliseconds).
   */
  check() {
    this.lastTick = Date.now();
    const entries = this.entries;
    this.entries = [];

    return entries;
  }

  /**
   * Clock a new step in with its associated duration,
   * the mesured time will be the elapsed time since either
   * {@link check()} or {@link clock()} was last called.
   * @param {string} name - Name of the step to mesure the
   *                        duration of.
   * @return {number} Duration this step took (in milliseconds)
   */
  clock(name) {
    const now = Date.now();
    const elapsed = now - this.lastTick;
    this.entries.push([name, elapsed]);
    this.lastTick = now;

    return elapsed;
  }
}

export default SimpleStopwatch;
