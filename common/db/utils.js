import TypeORM from 'typeorm';
import {scryptSync} from 'crypto';
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

export {init, hashPassword, saltLength};
