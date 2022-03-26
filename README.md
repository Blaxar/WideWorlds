# WideWorlds

## Tools

### aw2db

`aw2db` is the basic utility to import AW worlds into a Wide Worlds' database (sqlite3) from attr and prop dump files.

#### Usage:
```
Positionals:
  sql  Path to the destination SQLite3 database file, will be created if need be
                                        [string] [default: "wideworlds.sqlite3"]

Options:
      --version         Show version number                            [boolean]
  -a, --attr            Input AW world attributes dump file (e.g. atworld.txt)
                                                                        [string]
  -p, --prop            Input AW props dump file (e.g. propworld.txt)   [string]
  -e, --encoding        Expected encoding from dump files
                                              [string] [default: "windows-1252"]
      --worldId, --wid  Fallback world ID if no World entry is created (no attr
                        file provided)                              [default: 0]
  -h, --help            Show help                                      [boolean]
```

#### Example:

```bash
node tools/aw2db.js myuniverse.sqlite3 --attr ./atworld.txt --prop ./propteleport.txt
```

This will result in `myuniverse.sqlite3` created with the world described in `./atworld.txt` all the imported props from `./propteleport.txt`.