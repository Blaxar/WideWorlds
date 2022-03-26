const db = require('../common/db/utils');
const World = require('../common/db/model/World').World;
const Prop = require('../common/db/model/Prop').Prop;
const yargs = require('yargs');
const iconvlite = require('iconv-lite');
const fs = require('fs');

const worldAttr = {
    0: 'name',
    3: 'path',
    25: 'welcome',
    61: 'skybox',
    64: 'keywords',
    65: 'enableTerrain',
    69: 'entry',
    70: 'skyColorTopR',
    71: 'skyColorTopG',
    72: 'skyColorTopB',
    73: 'skyColorNorthR',
    74: 'skyColorNorthG',
    75: 'skyColorNorthB',
    76: 'skyColorEastR',
    77: 'skyColorEastG',
    78: 'skyColorEastB',
    79: 'skyColorSouthR',
    80: 'skyColorSouthG',
    81: 'skyColorSouthB',
    82: 'skyColorWestR',
    83: 'skyColorWestG',
    84: 'skyColorWestB',
    85: 'skyColorBottomR',
    86: 'skyColorBottomG',
    87: 'skyColorBottomB'
}

const argv = yargs
  .positional('sql', {
    description: 'Path to the destination SQLite3 database file, will be created if need be',
    type: 'string',
    default: 'wideworlds.sqlite3'
  })
  .option('attr', {
    alias: 'a',
    description: 'Input AW world attributes dump file (e.g. atworld.txt)',
    type: 'string'
  })
  .option('prop', {
    alias: 'p',
    description: 'Input AW props dump file (e.g. propworld.txt)',
    type: 'string'
  })
  .option('encoding', {
    alias: 'e',
    description: 'Expected encoding from dump files',
    type: 'string',
    default: 'windows-1252'
  })
  .option('worldId', {
    alias: 'wid',
    description: 'Fallback world ID if no World entry is created (no attr file provided)',
    type: 'integer',
    default: 0
  }).option('propBatchSize', {
    alias: 'batch',
    description: 'Maximum amount of props to commit to database a the same time',
    type: 'integer',
    default: 2000
  })
  .help()
  .alias('help', 'h').argv;

const parseAttrFile = (path) => {
    const worldData = {};

    // Load world attr file content
    const content = fs.readFileSync(path);

    const skyColor = {top: [0, 0, 0],
                      north: [0, 0, 0],
                      east: [0, 0, 0],
                      south: [0, 0, 0],
                      west: [0, 0, 0],
                      bottom: [0, 0, 0]};

    // Decode the file and parse each line
    for (const entry of iconvlite.decode(content, argv.encoding).split(/\r?\n/)) {

        // Fetch key and value
        const [id, value] = entry.split(/ (.*)/).slice(0,2);
        const key = worldAttr[id];

        if (!key) {
            // Ignore unknown key and move on
            continue;
        }

        if (key.startsWith('skyColor')) {
            const trimmedKey = key.replace('skyColor', '');
            for (const prefix of ['Top', 'North', 'East', 'South', 'West', 'Bottom']) {
                if (trimmedKey.startsWith(prefix)) {
                    switch (trimmedKey.slice(-1)) {
                    case 'R':
                        skyColor[prefix.toLowerCase()][0] = parseInt(value);
                        break;
                    case 'G':
                        skyColor[prefix.toLowerCase()][1] = parseInt(value);
                        break;
                    case 'B':
                        skyColor[prefix.toLowerCase()][2] = parseInt(value);
                        break;
                    }
                }
            }
        } else if (key == 'enableTerrain') {
            worldData[key] = value == 'Y' ? true : false;
        } else {
            worldData[key] = value;
        }
    }

    worldData['skyColor'] = skyColor;

    return worldData;
};

function* parsePropFile(path) {
    // Load world attr file content
    const content = fs.readFileSync(path);

    // Decode the file and parse each line
    for (const entry of iconvlite.decode(content, argv.encoding).split(/\r\n/)) {
        const sanitizedEntry = entry.replace(iconvlite.decode([0x7f], argv.encoding)[0], '\n')
              .replace(iconvlite.decode([0x80], argv.encoding)[0], '\r');

        const propSplit = sanitizedEntry.split(' ');

        /* Parse user id */
        const userId = parseInt(propSplit[0])

        if (isNaN(userId)) {
            continue;
        }

        /* Parse date (timestamp) */
        const date = parseInt(propSplit[1])

        /* Parse position and orientation */
        const x = parseInt(propSplit[2]);
        const y = parseInt(propSplit[3]);
        const z = parseInt(propSplit[4]);
        const yaw = parseInt(propSplit[5])
        const pitch = parseInt(propSplit[6])
        const roll = parseInt(propSplit[7])

        /* Parse name, action and description */
        const nameLength = parseInt(propSplit[8]);
        const descriptionLength = parseInt(propSplit[9]);
        const actionLength = parseInt(propSplit[10]);
        const propData = propSplit.slice(11).join(' ');

        let propDataOffset = 0;
        const name = propData.slice(propDataOffset, propDataOffset += nameLength);
        const description = propData.slice(propDataOffset, propDataOffset += descriptionLength);
        const action = propData.slice(propDataOffset, propDataOffset += actionLength);

        yield {userId, date, x, y, z, yaw, pitch, roll, name, description, action};
    }
};

db.init(argv.sql).then(async connection => {
    let worldId = argv.worldId;

    if (argv.attr) {
        const data = parseAttrFile(argv.attr);
        worldId = (await connection.manager.save([new World(undefined, data.name || '', JSON.stringify(data))]))[0].id;
    }

    if (argv.prop) {
        const props = [];

        for (const p of parsePropFile(argv.prop)) {
            props.push(new Prop(undefined, worldId, p.userId, p.date, p.x, p.y, p.z, p.yaw, p.pitch, p.roll,
                                p.name, p.description, p.action));

            if (props.length >= argv.propBatchSize) {
                await connection.manager.save(props.splice(0, props.length));
            }
        }

        // Save any remaining prop (if any)
        if (props.length) {
            await connection.manager.save(props);
        }
    }
});
