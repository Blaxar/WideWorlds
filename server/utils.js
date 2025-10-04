/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import jwt from 'jsonwebtoken';
import {URL} from 'url';
import logger from './logger.js';

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
 * @openapi
 * components:
 *   schemas:
 *     ValidationErrorEntry:
 *       type: object
 *       properties:
 *         name:
 *           description: Full name of the error
 *           type: string
 *           example: nonUniqueBodyEmail
 *         ctx:
 *           description: Location of the field
 *           type: string
 *           example: body
 *         field:
 *           description: Name of the field
 *           type: string
 *           example: email
 *         desc:
 *           description: Human-readable description of the error
 *           type: string
 *           example: Email is already in use
 *
 *     ValidationErrorResponse:
 *       type: array
 *       description: List of validation errors
 *       items:
 *         $ref: '#/components/schemas/ValidationErrorEntry'
 */

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

export {roleLevels, hasUserRole, hasUserIdInParams, middleOr, formatHttpErrors,
  middleAnd, forbiddenOnFalse, getAuthenticationCallback, requestRemoteAddress};
