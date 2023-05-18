#!/usr/bin/env node

/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

// About AW Elevdump format:
// https://wiki.activeworlds.com//index.php?title=Elevdump

import {zeroElevationValue} from '../common/terrain-utils.js';
import TerrainStorage from '../server/terrain-storage.js';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import * as fs from 'fs';

const elevdumpVersionRegex = /^elevdump version ([0-9]+)$/;

const argv = yargs(hideBin(process.argv))
    .command('import <elev>', 'Import AW elevation dump into a' +
        ' WideWorlds terrain folder (PNG files)',
    (yargs) => {
      yargs.positional('elev', {
        description: 'Path to the source AW elevation dump file',
        type: 'string',
      })
          .option('output', {
            alias: 'o',
            description: 'Output folder for the terrain, will be' +
            ' created if needed',
            type: 'string',
            default: './terrain',
          });
    }).demandCommand()
    .help()
    .alias('help', 'h').argv;

const lines = fs.readFileSync(argv.elev, 'utf8').split('\r\n');
console.log(`Reading ${argv.elev}`);

// Check elevdump version
const match = lines[0].match(elevdumpVersionRegex);

if (!match || !match[1]) {
  console.error('Invalid elevdump version, exiting.');
  exit(1);
}

if (lines.length < 2) {
  console.log('No elevation information provided, exiting');
  exit(1);
}

const elevdumpVersion = parseInt(match[1]);
console.log(`Parsing elevedump file version ${elevdumpVersion}.`);

const terrainStorage = new TerrainStorage(argv.output);

console.log(`Importing ${lines.length - 1} nodes...`);

// Iterate on each line from there
for (const line of lines.slice(1)) {
  // Ignore empty lines
  if (!line.length) continue;

  const tokens = line.split(' ').map((value) => parseInt(value));

  const pageX = tokens[0];
  const pageZ = tokens[1];
  const coordX = tokens[2];
  const coordZ = tokens[3];
  const nodeRadius = tokens[4];
  const nodeDiameter = (nodeRadius * 2);
  const nodeSize = nodeDiameter * nodeDiameter;
  const nbTextures = tokens[5];
  const nbHeights = tokens[6];
  let textures = tokens.slice(7, 7 + nbTextures);
  let heights = tokens.slice(7 + nbTextures, 7 + nbTextures + nbHeights)
      .map((value) => {
        let newValue = value + zeroElevationValue;
        if (newValue > 0xffff) newValue = 0xffff;
        if (newValue < 0) newValue = 0;
        return newValue;
      }); // Adjust to unsigned integer representation and clamp

  // Handle flat node scenarios
  if (nbTextures == 1) {
    textures = new Array(nodeSize)
        .fill(textures[0], 0, nodeDiameter * nodeDiameter);
  }

  if (nbHeights == 1) {
    heights = new Array(nodeSize)
        .fill(heights[0], 0, nodeDiameter * nodeDiameter);
  }

  await terrainStorage.setNode(pageX, pageZ, coordX, coordZ, nodeDiameter,
      heights, textures, true);
}

console.log(`Done.`);
