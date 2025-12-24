/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import jwt from 'jsonwebtoken';
import {URL} from 'url';
import logger from './logger.js';
import World from '../common/db/model/World.js';
import User from '../common/db/model/User.js';

const roleLevels = {
  'tourist': 0,
  'citizen': 1,
  'admin': 2,
};

const bearerRegex = /^Bearer (.*)$/i;

const getAuthenticationCallback = (secret) => ((req, res, next) => {
  // Get Bearer token, we strip the 'Bearer' part
  const authMatch = req.headers['authorization']?.match(bearerRegex);
  const token = authMatch && authMatch[1];

  const {pathname} = new URL(req.url, 'https://wideworlds.org');
  // We don't care about the base

  const remoteAddress = requestRemoteAddress(req);

  // Test if token is falsy
  if (!token) {
    // We do not understand the credentials being provided at all (malformed)
    logger.warn(`Unauthorized HTTP [${req.method}] connection to ${pathname} ` +
                `from '${remoteAddress}': malformed credentials`);
    return res.status(401).json({});
  }

  jwt.verify(token, secret, (err, payload) => {
    if (err) {
      // We aknowledge a Bearer token was provided to us, but it is not valid
      logger.warn(`Unauthorized HTTP [${req.method}] connection to ` +
                  `${pathname} from '${remoteAddress}': invalid credentials`);
      return res.status(403).json({});
    }

    req.userId = payload.userId;
    req.userRole = payload.userRole;

    return next();
  });
});

const hasUserRole = (role, strict = false) => {
  return ((req) => {
    // If we don't enforce strict role check: the actual user
    // role can be superior or equal in rank to what's expected
    if ((!strict && roleLevels[req.userRole] >= roleLevels[role]) ||
        role == req.userRole) {
      return true;
    } else {
      return false;
    }
  });
};

const hasUserIdInParams = (param) => {
  return ((req) => {
    if (req.params[param] && req.params[param] == req.userId) {
      return true;
    } else {
      return false;
    }
  });
};

const middleOr = (firstCondition, secondCondition) => {
  return ((req) => {
    return firstCondition(req) || secondCondition(req);
  });
};

const middleAnd = (firstCondition, secondCondition) => {
  return ((req) => {
    return firstCondition(req) && secondCondition(req);
  });
};

const forbiddenOnFalse = (condition) => {
  return ((req, res, next) => {
    if (condition(req)) {
      return next();
    } else {
      // We aknowledge a Bearer token was provided to us,
      // but it is not valid
      return res.status(403).json({});
    }
  });
};

const requestRemoteAddress = (req) => {
  return req.headers['X-Forwarded-For'] ? req.headers['X-Forwarded-For'] :
    req.socket.remoteAddress;
};

const upFirstChar = (str) => str.charAt(0).toUpperCase() + str.slice(1);

/**
 * Format HTTP validation errors from requests
 * @param {object[]} errs - Errors from Express' validationResult().
 * @return {object[]} List of HTTP validation errors.
 */
const formatHttpErrors = (errs) => errs.formatWith((err) => ({
  name: `invalid${upFirstChar(err.location)}` + err.path.split('/')
      .map(upFirstChar).join(''),
  ctx: err.location,
  field: err.path,
  desc: err.msg,
})).array();

/**
 * @typedef WorldCacheEntry
 * @type {object}
 * @property {integer} id - ID of the world.
 * @property {string} name - Name of the world.
 * @property {string} data - JSON object holding various world properties.
 */

/**
 * @typedef UserCacheEntry
 * @type {object}
 * @property {integer} id - ID of the user.
 * @property {string} name - Name of the user.
 * @property {string} role - Role of the user.
 * @property {string} email - Email address of the user.
 */

/**
 * Load world and user caches from database, meant to be called once at startup
 * @param {object} dbManager - TypeORM manager to perform database queries.
 * @param {Map<integer, WorldCacheEntry>} worldCache - World cache map, indexed
 *                                                     by ID.
 * @param {Map<integer, userCacheEntry>} userCache - User cache map, indexed by
 *                                                   ID.
 */
function loadCaches(dbManager, worldCache, userCache) {
  // Load world cache
  dbManager.createQueryBuilder(World, 'world').getMany()
      .then((worlds) => {
        for (const world of worlds) {
          worldCache.set(world.id,
              (({id, name, data}) => ({id, name, data}))(world));
        }
      }); // TODO: handle error (if any)

  // Load user cache
  dbManager.createQueryBuilder(User, 'user').getMany()
      .then((users) => {
      // Fill-in the cache by binding IDs to names and roles
        for (const user of users) {
          userCache.set(user.id,
              (({id, name, role, email}) => ({id, name, role, email}))(user));
        }
      }); // TODO: handle error (if any)
}

export {roleLevels, hasUserRole, hasUserIdInParams, middleOr, formatHttpErrors,
  middleAnd, forbiddenOnFalse, getAuthenticationCallback, requestRemoteAddress,
  loadCaches};
