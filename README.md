# WideWorlds

## Working on it

The simplest way to work on this project is to run the _Node.js_ server for the http/ws backend and _Vite_ to build and serve the _Vue.js_ frontend on the fly.

### Install dependencies

Run the following in the root folder of the project:

```bash
npm i
```

You will of course need a working version of `npm` installed on your system.

### `Node.js` backend server app

To start the server, simply run the following:

```bash
npm run server
```

This will run the http/ws server app listening on port `8080`.

You can customize the port by running the following:

```bash
npm run server -- -p <port>
```

For additional info, you can still invoke some help:
```bash
npm run server -- -h

Options:
      --version  Show version number                                   [boolean]
      --db       Path to the SQLite3 database file, will be created if need be
                                        [string] [default: "wideworlds.sqlite3"]
  -p, --port     Port to listen on for http and ws requests
                                                      [string] [default: "8080"]
  -h, --help     Show help
```

Note that, for the server to be useful, you'll need some database with existing worlds, props and users...
See [aw2db](###aw2db) in the [Tools](##Tools) section.

### `Vue.js` frontend building with `Vite`

To easily build and serve frontend content, you will need to run the following:

```bash
VITE_SERVER_URL=http://localhost:8080 npm run client-dev
```

Prepending `VITE_HTTP_SERVER_URL=<url>` as environment variable is essential, as it tells the _Vue.js_ app which base url to use when performing http requests.

You can then browse the app going to `http://localhost:3000` on your favorite web browser, note that building and serving the _Vue.js_ app this way is only meant for development and debugging purposes, as editing source files from the frontend should trigger a thorough rebuilding and automatically reload the web page, which is convenient for live-testing of various changes.

## Tools

### aw2db

`aw2db` is the basic utility to import AW worlds into a Wide Worlds' database (sqlite3) from attr and prop dump files.

#### Usage:
```
Positionals:
  sql  Path to the destination SQLite3 database file, will be created if need be
                                        [string] [default: "wideworlds.sqlite3"]

Options:
      --version             Show version number                        [boolean]
  -a, --attr                Input AW world attributes dump file (e.g. atworld.tx
                            t)                                          [string]
  -p, --prop                Input AW props dump file (e.g. propworld.txt)
                                                                        [string]
  -e, --encoding            Expected encoding from dump files
                                              [string] [default: "windows-1252"]
      --worldId, --wid      Fallback world ID if no World entry is created (no a
                            ttr file provided)                      [default: 0]
  -b, --batchSize           Maximum amount of props and users to commit to datab
                            ase a the same time                  [default: 2000]
  -u, --autoGenerateUsers   Generate place-holder users based on unique user IDs
                             found in props            [boolean] [default: true]
      --pathOverride, --po  Set the object path value for the world to the provi
                            ded string, keep the original value otherwise
                                                        [string] [default: null]
  -h, --help                Show help                                  [boolean]
```

#### Example:

```bash
node tools/aw2db.js myuniverse.sqlite3 --attr ./atworld.txt --prop ./propworld.txt
```

This will result in `myuniverse.sqlite3` created with the world described in `./atworld.txt` and all the imported props from `./propworld.txt`.