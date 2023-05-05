import * as db from '../common/db/utils.js';
import World from '../common/db/model/World.js';
import Prop from '../common/db/model/Prop.js';
import User from '../common/db/model/User.js';
import * as crypto from 'crypto';
import yargs from 'yargs';
import iconvlite from 'iconv-lite';
import fs from 'fs';

const worldAttr = {
  0: 'name',
  3: 'path',
  25: 'welcome',
  41: 'dirLightPosX',
  42: 'dirLightPosY',
  43: 'dirLightPosZ',
  44: 'directionalColorR',
  45: 'directionalColorG',
  46: 'directionalColorB',
  47: 'ambientColorR',
  48: 'ambientColorG',
  49: 'ambientColorB',
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
  87: 'skyColorBottomB',
};


const argv = yargs(process.argv)
    .positional('sql', {
      description: 'Path to the destination SQLite3 database file,' +
        ' will be created if need be',
      type: 'string',
      default: 'wideworlds.sqlite3',
    })
    .option('attr', {
      alias: 'a',
      description: 'Input AW world attributes dump file (e.g. atworld.txt)',
      type: 'string',
    })
    .option('prop', {
      alias: 'p',
      description: 'Input AW props dump file (e.g. propworld.txt)',
      type: 'string',
    })
    .option('encoding', {
      alias: 'e',
      description: 'Expected encoding from dump files',
      type: 'string',
      default: 'windows-1252',
    })
    .option('worldId', {
      alias: 'wid',
      description: 'Fallback world ID if no World entry is created' +
        ' (no attr file provided)',
      type: 'integer',
      default: 0,
    }).option('batchSize', {
      alias: 'b',
      description: 'Maximum amount of props and users to commit to' +
        ' database a the same time',
      type: 'integer',
      default: 2000,
    })
    .option('autoGenerateUsers', {
      alias: 'u',
      description: 'Generate place-holder users based on unique user' +
        ' IDs found in props',
      type: 'boolean',
      default: true,
    })
    .option('pathOverride', {
      alias: 'po',
      description: 'Set the object path value for the world to the provided' +
        ' string, keep the original value otherwise',
      type: 'string',
      default: null,
    })
    .help()
    .alias('help', 'h').argv;

/**
 * Parse world attribute file
 * @param {string} path - Path to the world attribute file.
 * @return {object} Object holding parsed world attributes.
 */
function parseAttrFile(path) {
  const worldData = {};

  // Load world attr file content
  const content = fs.readFileSync(path);
  const skyColors = {top: [0, 0, 0],
    north: [0, 0, 0],
    east: [0, 0, 0],
    south: [0, 0, 0],
    west: [0, 0, 0],
    bottom: [0, 0, 0]};


  const ambientColor = [];
  const directionalColor = [];
  const directionalLightPosition = [];

  // Decode the file and parse each line
  for (const entry of iconvlite.decode(content, argv.encoding).split(/\r?\n/)) {
    // Fetch key and value
    const [id, value] = entry.split(/ (.*)/).slice(0, 2);
    const key = worldAttr[id];

    if (!key) {
      // Ignore unknown key and move on
      continue;
    }

    if (key.startsWith('skyColor')) {
      const prefixes = ['Top', 'North', 'East', 'South', 'West', 'Bottom'];
      const trimmedKey = key.replace('skyColor', '');
      for (const prefix of prefixes) {
        if (trimmedKey.startsWith(prefix)) {
          switch (trimmedKey.slice(-1)) {
            case 'R':
              skyColors[prefix.toLowerCase()][0] = parseInt(value);
              break;
            case 'G':
              skyColors[prefix.toLowerCase()][1] = parseInt(value);
              break;
            case 'B':
              skyColors[prefix.toLowerCase()][2] = parseInt(value);
              break;
          }
        }
      }
    } else if (key.startsWith('ambientColor')) {
      const trimmedKey = key.replace('ambientColor', '');
      switch (trimmedKey.slice(-1)) {
        case 'R':
          ambientColor[0] = parseInt(value);
          break;
        case 'G':
          ambientColor[1] = parseInt(value);
          break;
        case 'B':
          ambientColor[2] = parseInt(value);
          break;
      }
    } else if (key.startsWith('directionalColor')) {
      const trimmedKey = key.replace('directionalColor', '');
      switch (trimmedKey.slice(-1)) {
        case 'R':
          directionalColor[0] = parseInt(value);
          break;
        case 'G':
          directionalColor[1] = parseInt(value);
          break;
        case 'B':
          directionalColor[2] = parseInt(value);
          break;
      }
    } else if (key.startsWith('dirLightPos')) {
      const trimmedKey = key.replace('dirLightPos', '');
      switch (trimmedKey.slice(-1)) {
        case 'X':
          directionalLightPosition[0] = parseFloat(value);
          break;
        case 'Y':
          directionalLightPosition[1] = parseFloat(value);
          break;
        case 'Z':
          directionalLightPosition[2] = parseFloat(value);
          break;
      }
    } else if (key === 'enableTerrain') {
      worldData[key] = value === 'Y' ? true : false;
    } else if (key === 'path') {
      worldData[key] = argv.pathOverride ? argv.pathOverride : value;
    } else {
      worldData[key] = value;
    }
  }

  worldData['ambientColor'] =
    rgbToHex(
        ambientColor[0],
        ambientColor[1],
        ambientColor[2]);
  worldData['ambientLightIntensity'] = 0.6;
  worldData['skyColors'] = skyColors;
  worldData['directionalColor'] = directionalColor;
  worldData['dirLightPos'] = directionalLightPosition;
  worldData['dirLightIntensity'] = 0.6;

  return worldData;
};

/**
  * Converts RGB values into Hex
  * @param {integer} r - red
  * @param {integer} g - red
  * @param {integer} b - red
  * @return {string} returns a hex color string
*/
function rgbToHex(r, g, b) {
  const hex = ((r << 16) | (g << 8) | b).toString(16);
  return '0'.repeat(6 - hex.length) + hex;
}

/**
 * Parse world prop file
 * @param {string} path - Path to the prop file.
 * @yield {array} Parsed world prop entries.
 */
function* parsePropFile(path) {
  // Load world attr file content
  const content = fs.readFileSync(path);

  // Decode the file and parse each line
  for (const entry of iconvlite.decode(content, argv.encoding).split(/\r\n/)) {
    const sanitizedEntry =
      entry.replace(iconvlite.decode([0x7f], argv.encoding)[0], '\n')
          .replace(iconvlite.decode([0x80], argv.encoding)[0], '\r');

    const propSplit = sanitizedEntry.split(' ');

    // Parse user id
    const userId = parseInt(propSplit[0]);

    if (isNaN(userId)) {
      continue;
    }

    /* Parse date (timestamp) */
    const date = parseInt(propSplit[1]);

    // Parse position and orientation
    const x = parseInt(propSplit[2]);
    const y = parseInt(propSplit[3]);
    const z = parseInt(propSplit[4]);
    const yaw = parseInt(propSplit[5]);
    const pitch = parseInt(propSplit[6]);
    const roll = parseInt(propSplit[7]);

    // Parse name, action and description
    const nameLength = parseInt(propSplit[8]);
    const descriptionLength = parseInt(propSplit[9]);
    const actionLength = parseInt(propSplit[10]);
    const propData = propSplit.slice(11).join(' ');

    let propDataOffset = 0;
    const name = propData.slice(propDataOffset, propDataOffset += nameLength);
    const description = propData.slice(propDataOffset,
        propDataOffset += descriptionLength);
    const action = propData.slice(propDataOffset,
        propDataOffset += actionLength);

    yield {userId, date, x, y, z, yaw, pitch, roll, name, description, action};
  }
};

const makeDefaultUser = (id) => {
  const name = 'user#' + id;
  const salt = crypto.randomBytes(db.saltLength).toString('base64');

  // Use the name as password
  return new User(id, name, db.hashPassword(name, salt), '', 'user', salt);
};

db.init(argv.sql).then(async (connection) => {
  let worldId = argv.worldId;

  if (argv.attr) {
    const data = parseAttrFile(argv.attr);
    worldId = (await connection.manager.save([new World(undefined, data.name ||
        '', JSON.stringify(data))]))[0].id;
  }

  if (argv.prop) {
    const props = [];
    const users = [];
    const userIdSet = new Set();

    for (const p of parsePropFile(argv.prop)) {
      props.push(new Prop(undefined, worldId, p.userId, p.date, p.x, p.y, p.z,
          p.yaw, p.pitch, p.roll, p.name, p.description, p.action));

      if (argv.autoGenerateUsers && !userIdSet.has(p.userId)) {
        // We generate a new user for each new user ID we encounter in prop
        // attributes
        users.push(makeDefaultUser(p.userId));
        userIdSet.add(p.userId);
      }

      // We save props by batch, lest we run into memory issues by letting the
      // array grow to much, that's also why 'parsePropFile' yields results
      // through an iterator instead of just returning one giant prop array
      // all at once
      if (props.length >= argv.batchSize) {
        await connection.manager.save(props.splice(0, props.length));
      }

      // Same as above, but for users
      if (users.length >= argv.batchSize) {
        await connection.manager.save(users.splice(0, users.length));
      }
    }

    // Save remaining props (if any)
    if (props.length) {
      await connection.manager.save(props);
    }

    // Save remaining users (if any)
    if (users.length) {
      await connection.manager.save(users);
    }
  }
});
