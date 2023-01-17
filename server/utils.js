/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

const roleLevels = {
  'tourist': 0,
  'citizen': 1,
  'admin': 2,
};

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
  middleAnd, forbiddenOnFalse};
