/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import * as db from '../common/db/utils.js';
import logger from './logger.js';
import User from '../common/db/model/User.js';
import * as crypto from 'crypto';
import {hasUserRole, hasUserIdInParams, middleOr, forbiddenOnFalse,
  formatHttpErrors, pathIdSanitizer} from './utils.js';
import {param, body, validationResult} from 'express-validator';

const minNbUsersPerPage = 1;
const defaultNbUsersPerPage = 200;
const maxNbUsersPerPage = defaultNbUsersPerPage*10;

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

/*
 * Validators for user API POST (mandatory = true) and
 * PUT (mandatory = false) requests
 */
const userBodyValidators = (mandatory) => [
  body('email').isEmail().optional(mandatory ? false : {nullable: false})
      .withMessage('Must be a valid email string'),
  body('name').isString().optional(mandatory ? false : {nullable: false})
      .withMessage('Must be a string'),
  body('role').isIn(['admin', 'citizen', 'tourist'])
      .optional(mandatory ? false : {nullable: false})
      .withMessage('Must be either one of "admin", "citizen" or "tourist"'),
  body('password').isString().optional(mandatory ? false : {nullable: false})
      .withMessage('Must be a string'),
  body('privilegePassword').isString().optional({nullable: true})
      .withMessage('Must be either null or a string'),
];

/**
 * Register user-related endpoints into the expressjs app
 * @param {object} app - express.js app.
 * @param {Function} authenticate - Authentication function for the http
 *                                  requests.
 * @param {object} connection - TypeORM connection instance.
 * @param {object} ctx - Parent HTTP spawner context.
 */
function registerUsersEndpoints(app, authenticate, connection, ctx) {
  const {userCache} = ctx;

  /*
   * User ID validator for user API requests (GET, PUT and DELETE)
   */
  const userIdValidator = param('id').custom((id) => userCache.has(id));

  /**
     * @openapi
     * components:
     *   schemas:
     *     User:
     *       type: object
     *       properties:
     *         id:
     *           description: ID of the user
     *           type: integer
     *           example: 3247
     *         name:
     *           description: Name of the user
     *           type: string
     *           example: johndoe
     *         email:
     *           description: Email address bound to this user account
     *           type: string
     *           example: john.doe@domain.com
     *         role:
     *           description: |
     *             Role of the user, can be one of `admin`, `citizen` or \
     *             `tourist`
     *           type: string
     *           example: citizen
     *
     *     AllUsers:
     *       type: array
     *       description: List of existing users
     *       items:
     *         $ref: '#/components/schemas/User'
     *
     */

  /**
     * @openapi
     * /api/users:
     *   get:
     *     description: Get the list of all users
     *     operationId: get-users
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Successful request listing all existing users
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/AllUsers'
     *       401:
     *         description: Authentication required
     *       403:
     *         description: Action not allowed for this user, admin level
     *                      required
     *       500:
     *         description: Internal error
     */
  app.get('/api/users', authenticate, forbiddenOnFalse(hasUserRole('admin')),
      (req, res) => {
        res.setHeader('Content-Type', 'application/json');

        // Fetch pagination info from query parameters (if any)
        const page = req.query.page ? parseInt(req.query.page) : 0;
        const amount = req.query.amount ? parseInt(req.query.amount) :
              defaultNbUsersPerPage;

        if (!isFinite(page) || !isFinite(amount) ||
              amount > maxNbUsersPerPage ||
              amount < minNbUsersPerPage ||
              page < 0) {
          res.status(400).json({});
          return;
        }

        // Get a list of all existing users
        connection.manager.createQueryBuilder(User, 'user')
            .skip(page*amount).take(amount).getMany().then((users) =>
              res.send(users.map((user) => (({id, name, email, role}) =>
                ({id, name, email, role}))(user))),
            )
            .catch((e) => {
              logger.fatal('Critical DB access error while trying to get ' +
                             'list of users: ' + e);
              return res.status(500).json({});
            });
      });

  /**
     * @openapi
     * /api/users/{userId}:
     *   get:
     *     description: Get information about a single user
     *     operationId: get-user
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: userId
     *         schema:
     *           type: integer
     *         required: true
     *         description: Numeric ID of the user to get
     *     responses:
     *       200:
     *         description: Successful request getting information about
     *                      a single user
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/User'
     *       401:
     *         description: Authentication required
     *       403:
     *         description: Action not allowed for this user, admin level
     *                      required or the user ID needs to match the one
     *                      from the user issuing the request
     *       404:
     *         description: User not found given the provided ID
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ValidationErrorResponse'
     *       500:
     *         description: Internal error
     */
  app.get('/api/users/:id', authenticate, forbiddenOnFalse(
      middleOr(hasUserRole('admin'), hasUserIdInParams('id'))),
  pathIdSanitizer,
  userIdValidator,
  (req, res) => {
    const errors = validationResult(req);
    res.setHeader('Content-Type', 'application/json');

    // Get a single user using their ID (return 404 if not found)
    if (!errors.isEmpty()) {
      res.status(404).json(formatHttpErrors(errors));
      return;
    }

    res.json(userCache.get(req.params.id));
  });

  /**
     * @openapi
     * components:
     *   schemas:
     *     UserCreation:
     *       type: object
     *       required:
     *         - name
     *         - email
     *         - role
     *         - password
     *       properties:
     *         name:
     *           description: Name of the user
     *           type: string
     *         email:
     *           description: Email address bound to this user account
     *           type: string
     *         role:
     *           description: Role of the user, can be one of `admin`,
     *                        `citizen` or `tourist`
     *           type: string
     *         password:
     *           description: Password of the user in clear text, will be stored
     *                        hashed and salted.
     *         privilegePassword:
     *           description: Optional (null for none) privilege password of the
     *                        user in clear text, will be stored hashed and
     *                        salted.
     *           type: string
     */

  /**
     * @openapi
     * /api/users:
     *   post:
     *     description: Create a new user
     *     operationId: post-user
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       description: Payload to create a new user
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/UserCreation'
     *     responses:
     *       200:
     *         description: Successful request creating a new user
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/User'
     *       400:
     *         description: Invalid value(s) provided
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ValidationErrorResponse'
     *       401:
     *         description: Authentication required
     *       403:
     *         description: Action not allowed for this user, admin level
     *                      required
     *       500:
     *         description: Internal error
     */
  app.post('/api/users', authenticate, forbiddenOnFalse(hasUserRole('admin')),
      ...userBodyValidators(true),
      (req, res) => {
        const errors = validationResult(req);
        res.setHeader('Content-Type', 'application/json');

        const value = req.body;
        const errorsJson = [];

        if (!errors.isEmpty()) {
          errorsJson.push(...formatHttpErrors(errors));
        }

        // Account password and privilege password cannot be the same
        if (value.password && (value.password === value.privilegePassword)) {
          errorsJson.push({
            name: 'invalidBodyPrivilegePassword',
            ctx: 'body',
            field: 'privilegePassword',
            desc: 'Account and privilege passwords must be different',
          });
        }

        // Name and email must not already be taken by another user

        for (const other of userCache.values()) {
          const {name, email} = other;

          if (name == value.name) {
            errorsJson.push({
              name: 'nonUniqueBodyName',
              ctx: 'body',
              field: 'name',
              desc: 'Name is already taken',
            });
          }

          if (email == value.email) {
            errorsJson.push({
              name: 'nonUniqueBodyEmail',
              ctx: 'body',
              field: 'email',
              desc: 'Email is already in use',
            });
          }
        }

        if (errorsJson.length) {
          res.status(400).json(errorsJson);
          return;
        }

        // The salt is generated on the spot, then we hash
        // the password with it and store both of them
        const salt = crypto.randomBytes(db.saltLength).toString('base64');

        const user = new User(
            undefined,
            value.name,
            db.hashPassword(value.password, salt),
            value.email,
            value.role,
            salt,
              value.privilegePassword ?
                db.hashPassword(value.privilegePassword, salt) : null,
        );

        connection.manager.save(user)
            .then((u) => {
              const {id, name, email, role} = u;

              // Update the local user cache for fast lookup elsewhere
              userCache.set(id,
                  (({id, name, role, email}) =>
                    ({id, name, role, email}))(u));
              res.json({id, name, email, role});
            })
            .catch((e) => {
              logger.fatal('Critical DB access error while trying to ' +
                               'post user: ' + e);
              return res.status(500).json({});
            });
      });

  /**
     * @openapi
     * components:
     *   schemas:
     *     UserUpdate:
     *       type: object
     *       properties:
     *         name:
     *           description: Name of the user
     *           type: string
     *           example: johndoe
     *         email:
     *           description: Email address bound to this user account
     *           type: string
     *           example: john.doe@domain.com
     *         role:
     *           description: |
     *             Role of the user, can be one of `admin`, `citizen` or \
     *             `tourist`
     *           type: string
     *           example: citizen
     *         password:
     *           description: Password of the user in clear text, will be stored
     *                        hashed and salted.
     *         privilegePassword:
     *           description: Optional (null for none) privilege password of the
     *                        user in clear text, will be stored hashed and
     *                        salted.
     *           type: string
     */

  /**
     * @openapi
     * /api/users/{userId}:
     *   put:
     *     description: Update a user
     *     operationId: put-user
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: userId
     *         schema:
     *           type: integer
     *         required: true
     *         description: Numeric ID of the user to update
     *     requestBody:
     *       description: Payload to update the user
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/UserUpdate'
     *     responses:
     *       200:
     *         description: Successful request updating a user
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/User'
     *       400:
     *         description: Invalid value(s) provided
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ValidationErrorResponse'
     *       401:
     *         description: Authentication required
     *       403:
     *         description: Action not allowed
     *       404:
     *         description: User not found given the provided ID
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ValidationErrorResponse'
     *       500:
     *         description: Internal error
     */
  app.put('/api/users/:id', authenticate,
      forbiddenOnFalse(middleOr(hasUserRole('admin'),
          hasUserIdInParams('id'))),
      pathIdSanitizer,
      userIdValidator,
      ...userBodyValidators(false),
      async (req, res, next) => {
        const errors = validationResult(req);
        res.setHeader('Content-Type', 'application/json');

        const uid = req.params.id;
        const userId = parseInt(req.userId);
        const value = req.body;

        const errorsJson = [];
        let errorCode = 400;

        if (!errors.isEmpty()) {
          errorsJson.push(...formatHttpErrors(errors));
        }

        if (errorsJson.length) {
          res.status(errors.array()[0].location == 'params' ? 404 : errorCode)
              .json(errorsJson);
          next();
          return;
        }

        const user = await connection.manager.createQueryBuilder(User, 'user')
            .where('user.id = :id', {id: uid}).getOne().then((user) => {
              if (user) {
                return user;
              } else {
                throw Error('The user should exist in DB if it is in cache');
              }
            })
            .catch((e) => {
              logger.fatal(
                  'Critical DB access error while trying to get user ' +
                    `#${req.params.id}: ` + e);
              res.status(500).json({});
              next();
            });

        if (!user) return;

        user.name = (typeof value.name !== 'undefined') ?
              value.name : user.name;
        user.password = (typeof value.password !== 'undefined') ?
              db.hashPassword(value.password, user.salt) : user.password;
        user.privilegePassword =
              (typeof value.privilegePassword !== 'undefined') ?
              (value.privilegePassword ?
              db.hashPassword(value.privilegePassword, user.salt) : null) :
              user.privilegePassword;
        user.email = (typeof value.email !== 'undefined') ?
              value.email : user.email;
        user.role = (typeof value.role !== 'undefined') ?
              value.role : user.role;

        // Account password and privilege password cannot be the same
        if (user.password === user.privilegePassword) {
          errorsJson.push({
            name: 'invalidBodyPrivilegePassword',
            ctx: 'body',
            field: 'privilegePassword',
            desc: 'Account and privilege passwords must be different',
          });
        }

        // Name and email must not already be taken
        for (const other of userCache.entries()) {
          const [id, {name, email}] = other;

          if (user.id == id) continue;

          if (name == value.name) {
            errorsJson.push({
              name: 'nonUniqueBodyName',
              ctx: 'body',
              field: 'name',
              desc: 'Name is already taken',
            });
          }

          if (email == value.email) {
            errorsJson.push({
              name: 'nonUniqueBodyEmail',
              ctx: 'body',
              field: 'email',
              desc: 'Email is already in use',
            });
          }
        }

        // The user issuing the request cannot modify its own role,
        if (userId === uid && userCache.get(uid).role != user.role) {
          errorCode = 403;
          errorsJson.push({
            name: 'staticBodyRole',
            ctx: 'body',
            field: 'role',
            desc: 'Cannot modify own role',
          });
        }

        if (errorsJson.length) {
          logger.error(errorsJson);
          res.status(errorCode).json(errorsJson);
          next();
          return;
        }

        connection.manager.save(user)
            .then((u) => {
              const {id, name, email, role} = u;

              // Update the local user cache for fast lookup elsewhere
              userCache.set(id,
                  (({id, name, role, email}) =>
                    ({id, name, role, email}))(u));

              res.json({id, name, email, role});
              next();
            })
            .catch((e) => {
              logger.fatal('Critical DB access error while trying to ' +
                             'put user: ' + e);
              res.status(500).json({});
              next();
            });
      });

  /**
     * @openapi
     * /api/users/{userId}:
     *   delete:
     *     description: Delete a single user
     *     operationId: delete-user
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: userId
     *         schema:
     *           type: integer
     *         required: true
     *         description: Numeric ID of the user to delete
     *     responses:
     *       200:
     *         description: Successful request deleting a user
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/User'
     *       401:
     *         description: Authentication required
     *       403:
     *         description: Action not allowed for this user, admin level
     *                      required or self-delete requested
     *       404:
     *         description: User not found given the provided ID
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ValidationErrorResponse'
     *       500:
     *         description: Internal error
     */
  app.delete('/api/users/:id', authenticate,
      forbiddenOnFalse(hasUserRole('admin')),
      pathIdSanitizer,
      userIdValidator,
      (req, res) => {
        const errors = validationResult(req);
        res.setHeader('Content-Type', 'application/json');

        // Get a single user using their id (return 404 if not found)
        if (!errors.isEmpty()) {
          res.status(404).json(formatHttpErrors(errors));
          return;
        }

        // Get user ID from request parameter
        const uid = req.params.id;

        // Get user ID from authorization
        const userId = parseInt(req.userId);

        // A user cannot delete themself
        if (uid === userId) {
          res.status(403).json({});
          return;
        }

        connection.manager.delete(User, uid)
            .then(() => {
              const {name, email, role} = userCache.get(uid);
              res.json({id: uid, name, email, role});

              // Remove user from the cache
              userCache.erase(uid);
            })
            .catch((e) => {
              logger.fatal('Critical DB access error while trying to ' +
                               `delete user #${uid}: ` + e);
              return res.status(500).json({});
            });
      });
}

export default registerUsersEndpoints;
