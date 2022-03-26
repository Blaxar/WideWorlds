const httpServer = require('./http');
const yargs = require('yargs');

const argv = yargs
  .option('db', {
    description: 'Path to the SQLite3 database file, will be created if need be',
    type: 'string',
    default: 'wideworlds.sqlite3'
  })
  .option('httpPort', {
    description: 'Port to listen on for http requests',
    type: 'string',
    default: '8080'
  })
  .help()
  .alias('help', 'h').argv;

httpServer(argv.db, argv.httpPort);
