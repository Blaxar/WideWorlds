/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import pino from 'pino';

const logger = pino({
  redact: [
    'err.stack', // Do not show verbose internals
  ],
});

export default logger;
