import {spawnHttpServer} from './http.js';
import {spawnWsServer} from './ws.js';
import yargs from 'yargs';
import {randomBytes} from 'crypto';

const argv = yargs(process.argv)
  .option('db', {
    description: 'Path to the SQLite3 database file, will be created if need be',
    type: 'string',
    default: 'wideworlds.sqlite3'
  })
  .option('httpPort', {
    description: 'Port to listen on for http and ws requests',
    type: 'string',
    default: '8080'
  })
  .help()
  .alias('help', 'h').argv;

// Generate a new secret for each runtime
const secret = randomBytes(64).toString('hex');

spawnHttpServer(argv.db, argv.httpPort, secret).then( server => spawnWsServer(server, secret));
