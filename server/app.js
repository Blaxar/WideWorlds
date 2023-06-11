/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {spawnHttpServer} from './http.js';
import {spawnWsServer} from './ws.js';
import yargs from 'yargs';
import {randomBytes} from 'crypto';

const argv = yargs(process.argv)
    .option('db', {
      description: 'Path to the SQLite3 database file,' +
        ' will be created if need be',
      type: 'string',
      default: 'wideworlds.sqlite3',
    })
    .option('port', {
      alias: 'p',
      description: 'Port to listen on for http and ws requests',
      type: 'string',
      default: '8080',
    })
    .option('worldFolder', {
      alias: 'w',
      description: 'Folder holding world-related files, will be' +
        ' created if need be',
      type: 'string',
      default: './worlds',
    })
    .help()
    .alias('help', 'h').argv;

// Generate a new secret for each runtime
const secret = randomBytes(64).toString('hex');

const userCache = new Map();
const terrainCache = new Map();

spawnHttpServer(argv.db, argv.port, secret, argv.worldFolder, userCache,
    terrainCache)
    .then(async ({server, onPropsChange}) => {
      const wsChannelManager =
          spawnWsServer(server, secret, userCache).wsChannelManager;
      onPropsChange((wid, data) => {
        wsChannelManager.broadcastWorldUpdate(wid, data);
      });
    });
