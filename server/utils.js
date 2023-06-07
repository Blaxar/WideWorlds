/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import jwt from 'jsonwebtoken';

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

  // Test if token is falsy
  if (!token) {
    // We do not understand the credentials being provided at all (malformed)
    return res.status(401).json({});
  }

  jwt.verify(token, secret, (err, payload) => {
    if (err) {
      // We aknowledge a Bearer token was provided to us, but it is not valid
      return res.status(403).json({});
    }

    req.userId = payload.userId;
    req.userRole = payload.userRole;

    next();
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
      next();
    } else {
      // We aknowledge a Bearer token was provided to us,
      // but it is not valid
      return res.status(403).json({});
    }
  });
};

export {roleLevels, hasUserRole, hasUserIdInParams, middleOr,
  middleAnd, forbiddenOnFalse, getAuthenticationCallback};
