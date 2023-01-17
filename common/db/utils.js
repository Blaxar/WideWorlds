/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import TypeORM from 'typeorm';
import {scryptSync, timingSafeEqual} from 'crypto';
import UserSchema from './entity/UserSchema.js';
import WorldSchema from './entity/WorldSchema.js';
import PropSchema from './entity/PropSchema.js';

const keyLength = 256;
const saltLength = 128;

const init = async (path) => {
  return await TypeORM.createConnection({
    type: 'sqlite',
    database: path,
    entities: [UserSchema,
      WorldSchema,
      PropSchema],
    synchronize: true,
  });
};

const hashPassword = (password, salt) => {
  return scryptSync(password, salt, keyLength).toString('base64');
};

const checkPassword = (password, salt, hash64) => {
  return timingSafeEqual(scryptSync(password, salt, keyLength),
      Buffer.from(hash64, 'base64'));
};

export {init, hashPassword, saltLength, checkPassword};
