#!/usr/bin/env node

/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import * as db from '../common/db/utils.js';
import World from '../common/db/model/World.js';
import Prop from '../common/db/model/Prop.js';
import User from '../common/db/model/User.js';
import * as crypto from 'crypto';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import iconvlite from 'iconv-lite';
import fs from 'fs';
import * as awcoordinates from 'awcoordinates';

const cmToMRatio = 0.01;
const tenthDegToRadRatio = Math.PI / 180.0 * 0.1;

const worldAttr = {
  0: 'name',
  3: 'path',
  11: 'fogColorR',
  12: 'fogColorG',
  13: 'fogColorB',
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
  51: 'enableFog',
  52: 'fogMinimum',
  53: 'fogMaximum',
  61: 'skybox',
  64: 'keywords',
  65: 'enableTerrain',
  69: 'entryPoint',
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
  111: 'waterTexture',
  112: 'waterOpacity',
  113: 'waterColorR',
  114: 'waterColorG',
  115: 'waterColorB',
  116: 'waterLevel',
  117: 'waterSurfaceMove',
  118: 'waterWaveMove',
  119: 'waterMask',
  120: 'waterBottomTexture',
  121: 'waterBottomMask',
  122: 'waterSpeed',
  122: 'waterEnabled',
  132: 'waterVisibility',
  134: 'soundWaterEnter', // TODO for sound support
  135: 'soundWaterExit', // TODO for sound support
  137: 'waterBuoyancy',
  141: 'terrainElevationOffset',
  145: 'waterUnderTerrain',
};


const argv = yargs(hideBin(process.argv))
    .command('* [sql]', 'Import AW prop and attr dumps into a WideWorlds' +
             ' sqlite3 database',
    (yargs) => {
      yargs.positional('sql', {
        description: 'Path to the destination SQLite3 database file,' +
        ' will be created if need be',
        type: 'string',
        default: 'wideworlds.sqlite3',
      })
          .option('attr', {
            alias: 'a',
            description: 'Input AW world attributes dump file' +
              ' (e.g. atworld.txt)',
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
            description: 'Set the object path value for the world to the' +
        ' provided string, keep the original value otherwise',
            type: 'string',
            default: null,
          })
          .option('enableTerrain', {
            alias: 'et',
            description: 'Override the enableTerrain flag with the provided' +
            ' value, keep the original one if none is provided',
            type: 'boolean',
            default: null,
          }).option('fixEncoding', {
            alias: 'fe',
            description: 'Try to fix common encoding errors from props' +
            ' action and description strings',
            type: 'boolean',
            default: false,
          }).option('version5', {
            alias: 'v5',
            description: 'Import a v5 propdump. Forces encoding to utf8',
            type: 'boolean',
            default: false,
          })
          .help()
          .alias('help', 'h');
    }).argv;


/**
 * Parse world water-related sub attributes
 * @param {Object} water - Dictionnary to holdi water properties.
 * @param {string} attrSubStr - Attribute name without the 'water' prefix.
 * @param {string} value - String value for this attribute.
 */
function parseWaterAttribute(water, attrSubStr, value) {
  switch (attrSubStr) {
    case 'Texture':
      water.texture = value;
      break;
    case 'Opacity':
      water.opacity = parseFloat(value);
      break;
    case 'ColorR':
      water.color[0] = parseInt(value);
      break;
    case 'ColorG':
      water.color[1] = parseInt(value);
      break;
    case 'ColorB':
      water.color[2] = parseInt(value);
      break;
    case 'Level':
      water.level = parseFloat(value);
      break;
    case 'SurfaceMove':
      water.surfaceMove = parseFloat(value);
      break;
    case 'WaveMove':
      water.waveMove = parseFloat(value);
      break;
    case 'Mask':
      water.texture = value;
      break;
    case 'BottomTexture':
      water.bottomTexture = value;
      break;
    case 'BottomMask':
      water.bottomMask = value;
      break;
    case 'Speed':
      water.speed = parseFloat(value);
      break;
    case 'Enabled':
      water.enabled = value === 'Y';
      break;
    case 'Visibility':
      water.visibility = parseFloat(value);
      break;
    case 'Buoyancy':
      water.buoyancy = parseFloat(value);
      break;
    case 'UnderTerrain':
      water.underTerrain = value === 'Y'; ;
      break;
  }
}


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

  const ambientColor = [0.0, 0.0, 0.0];
  const fogColor = [0.0, 0.0, 0.0];
  const directionalColor = [0.0, 0.0, 0.0];
  const directionalLightPosition = [0.0, 0.0, 0.0];
  const water = {enabled: false, color: [0.0, 0.0, 0.0]};

  // Decode the file and parse each line
  if (argv.v5) argv.encoding = 'utf8';
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
    } else if (key.startsWith('fogColor')) {
      const trimmedKey = key.replace('fogColor', '');
      switch (trimmedKey.slice(-1)) {
        case 'R':
          fogColor[0] = parseInt(value);
          break;
        case 'G':
          fogColor[1] = parseInt(value);
          break;
        case 'B':
          fogColor[2] = parseInt(value);
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
    } else if (key.startsWith('water')) {
      const trimmedKey = key.replace('water', '');
      parseWaterAttribute(water, trimmedKey, value);
    } else if (key === 'enableTerrain') {
      if (argv.enableTerrain !== null) {
        worldData[key] = argv.enableTerrain;
      } else {
        worldData[key] = value === 'Y';
      }
    } else if (key === 'entryPoint') {
      const normalizedCoordinates = JSON.parse(
          awcoordinates.normalize('WW ' + value),
      ).sdkParts;
      const coordinates = {
        x: normalizedCoordinates.x / 10,
        y: normalizedCoordinates.y / 10,
        z: normalizedCoordinates.z / 10,
        yaw: normalizedCoordinates.yaw / 10,
      };
      worldData[key] = coordinates;
    } else if (key === 'enableFog') {
      worldData[key] = value === 'Y';
    } else if (key === 'path') {
      worldData[key] = argv.pathOverride ? argv.pathOverride : value;
    } else if (key === 'terrainElevationOffset') {
      worldData[key] = parseFloat(value);
    } else {
      worldData[key] = value;
    }
  }

  worldData['ambientColor'] =
    rgbToHex(
        ambientColor[0],
        ambientColor[1],
        ambientColor[2]);
  worldData['skyColors'] = skyColors;
  worldData['fogColor'] =
  rgbToHex(
      fogColor[0],
      fogColor[1],
      fogColor[2]);

  worldData['directionalColor'] =
      rgbToHex(
          directionalColor[0],
          directionalColor[1],
          directionalColor[2]);
  worldData['dirLightPos'] = directionalLightPosition;
  water.color =
      rgbToHex(
          water.color[0],
          water.color[1],
          water.color[2]);
  worldData['water'] = water;

  return worldData;
};

/**
  * Convert RGB values into hexadecimal
  * @param {integer} r - red
  * @param {integer} g - green
  * @param {integer} b - blue
  * @return {string} Return a hexadecimal color string
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

    /* Parse date (timestamp in seconds) and convert it to milliseconds */
    const date = parseInt(propSplit[1]) * 1000;

    // Parse position and orientation
    const x = parseInt(propSplit[2]) * cmToMRatio;
    const y = parseInt(propSplit[3]) * cmToMRatio;
    const z = parseInt(propSplit[4]) * cmToMRatio;
    const yaw = parseInt(propSplit[5]) * tenthDegToRadRatio;
    const pitch = parseInt(propSplit[6]) * tenthDegToRadRatio;
    const roll = parseInt(propSplit[7]) * tenthDegToRadRatio;

    let propType;
    let nameLength;
    let descriptionLength;
    let actionLength;
    let dataLength;
    let propData;

    if (argv.v5) {
      // Parse name, action and description
      propType = parseInt(propSplit[8]);
      nameLength = parseInt(propSplit[9]);
      descriptionLength = parseInt(propSplit[10]);
      actionLength = parseInt(propSplit[11]);
      dataLength = parseInt(propSplit[12]);

      propData = propSplit.slice(13).join(' ');
    } else {
      // Parse name, action and description
      nameLength = parseInt(propSplit[8]);
      descriptionLength = parseInt(propSplit[9]);
      actionLength = parseInt(propSplit[10]);

      propData = propSplit.slice(11).join(' ');
    }
    let propDataOffset = 0;
    const name = propData.slice(propDataOffset, propDataOffset += nameLength);
    const description = propData.slice(propDataOffset,
        propDataOffset += descriptionLength);
    const action = propData.slice(propDataOffset,
        propDataOffset += actionLength);

    if (argv.v5) {
      // TODO: Actually import v4 data into db
      const objData = propData.slice(propDataOffset,
          propDataOffset += dataLength);
      yield {userId, date, x, y, z, yaw, pitch, roll, name, description, action,
        propType, objData};
    } else {
      yield {userId, date, x, y, z, yaw, pitch, roll, name, description,
        action};
    }
  }
};

/**
 * Fix various encoding issues from prop dump content
 * @param {string} content - Content to be fixed.
 * @return {string} Fixed content.
 */
function fixEncoding(content) {
  // Fix faulty line breaks
  return content.replaceAll('€\u007F', '\r\n').replaceAll('�\u007F', '\r\n');
}

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
      const description = argv.fixEncoding ? fixEncoding(p.description) :
          p.description;
      const action = argv.fixEncoding ? fixEncoding(p.action) : p.action;
      props.push(new Prop(undefined, worldId, p.userId, p.date, p.x, p.y, p.z,
          p.yaw, p.pitch, p.roll, p.name, description, action));

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
