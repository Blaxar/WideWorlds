#!/usr/bin/env node

/**
 * @author Nekohime <https://github.com/Nekohime>
 * Password-generating utility
*/

import crypto from 'crypto';
import * as db from '../common/db/utils.js';

if (process.argv[2] !== undefined && process.argv[2].length >= 1) {
  const password = process.argv[2];
  const salt = crypto.randomBytes(db.saltLength).toString('base64');

  const hashedPassword = db.hashPassword(password, salt);

  console.log('[Plaintext] ' + password);
  console.log('[Hashed Password] ' + hashedPassword);
  console.log('[Salt] ' + salt);
}
