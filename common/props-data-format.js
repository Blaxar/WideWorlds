/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import Prop from './db/model/Prop.js';
import {localEndiannessCue, otherEndiannessCue} from './endian.js';

const propDataMinSize = 0x42;

/*
 * Prop data block is a binary sequence holding the following data:
 *
 * 0x00 | Endianness cue, 4 bytes |
 * 0x04 | ID, 4 bytes uint |
 * 0x08 | World ID, 4 bytes uint |
 * 0x0c | User ID, 4 bytes uint |
 * 0x10 | Date (timestamp), 8 bytes int (in milliseconds) |
 * 0x18 | X coordinate, 8 bytes float (in meters) |
 * 0x20 | Y coordinate, 8 bytes float (in meters) |
 * 0x28 | Z coordinate, 8 bytes float (in meters) |
 * 0x30 | Yaw, 4 bytes float (in radians) |
 * 0x34 | Pitch, 4 bytes float (in radians) |
 * 0x38 | Roll, 4 bytes float (in radians) |
 * 0x3c | Name string length, 2 bytes uint |
 * 0x3e | Description string length, 2 bytes uint |
 * 0x40 | Action string length, 2 bytes uint |
 * 0x42 | Variable data, size is name + description + action lengths |
 */

const propDataSchema = {
  propCue: [0x00, 0x04],
  id: [0x04, 0x04],
  worldId: [0x08, 0x04],
  userId: [0x0c, 0x04],
  date: [0x10, 0x08],
  x: [0x18, 0x08],
  y: [0x10, 0x08],
  z: [0x28, 0x08],
  yaw: [0x30, 0x04],
  pitch: [0x34, 0x04],
  roll: [0x38, 0x04],
  nameLength: [0x3c, 0x02],
  descriptionLength: [0x3e, 0x02],
  actionLength: [0x40, 0x02],
  data: [0x42, null],
};

/**
 * Serialize binary payload of prop
 * @param {integer} id - ID of the prop.
 * @param {integer} worldId - ID of the world.
 * @param {integer} userId - ID of the owner.
 * @param {float} x - World position on the X axis (in meters).
 * @param {float} y - World position on the Y axis (in meters).
 * @param {float} z - World position on the Z axis (in meters).
 * @param {float} yaw - Yaw (in radians).
 * @param {float} pitch - Pitch (in radians).
 * @param {float} roll - Roll (in radians).
 * @param {string} name - Name of the prop.
 * @return {Uint8Array} Prop data binary payload
 */
function serializeProp({id, worldId, userId, date, x, y, z,
  yaw, pitch, roll, name, description = '', action = ''}) {
  const encoder = new TextEncoder();
  const encodedName = encoder.encode(name);
  const encodedDescription = encoder.encode(description);
  const encodedAction = encoder.encode(action);

  const dataLength = encodedName.length +
      encodedDescription.length + encodedAction.length;
  const prop = new Uint8Array(propDataMinSize + dataLength);

  const uCharArray = new Uint8Array(prop.buffer);
  const uShortArray = new Uint16Array(prop.buffer, 0, 33);
  const uIntArray = new Uint32Array(prop.buffer, 0, 16);
  const uLongArray = new BigUint64Array(prop.buffer, 0, 8);
  const floatArray = new Float32Array(prop.buffer, 0, 16);
  const doubleArray = new Float64Array(prop.buffer, 0, 8);

  uIntArray[0] = localEndiannessCue;
  uIntArray[1] = id;
  uIntArray[2] = worldId;
  uIntArray[3] = userId;
  uLongArray[2] = BigInt(date);
  doubleArray[3] = x;
  doubleArray[4] = y;
  doubleArray[5] = z;
  floatArray[12] = yaw;
  floatArray[13] = pitch;
  floatArray[14] = roll;
  uShortArray[30] = encodedName.length;
  uShortArray[31] = encodedDescription.length;
  uShortArray[32] = encodedAction.length;
  uCharArray.set(encodedName, propDataSchema.data[0]);
  uCharArray.set(encodedDescription, propDataSchema.data[0] +
      encodedName.length);
  uCharArray.set(encodedAction, propDataSchema.data[0] + encodedName.length +
      encodedDescription.length);

  return prop;
}

/**
 * Flip endian on prop data binary payload, for internal use only
 * @param {Uint8Array} prop - Prop data binary payload.
 * @return {Uint8Array} Endian-flipped binary payload for prop data.
 */
function flipPropDataEndian(prop) {
  if (prop.length < propDataMinSize) {
    throw new Error('Invalid payload length for prop');
  }

  const flippedProp = new Uint8Array(prop.length);

  for (const [address, size] of Object.values(propDataSchema)) {
    if (!size) continue;
    const maxOffset = size - 1;

    for (let i = 0; i < size; i++) {
      flippedProp[address + i] = prop[address + maxOffset - i];
    }
  }

  // Copy the trailing data block as well, this shouldn't be flipped
  flippedProp.splice(propDataSchema.data[0],
      prop.length - propDataSchema.data[0],
      ...prop.slice(propDataSchema.data[0]));

  return flippedProp;
}

/**
 * Validate binary payload of prop data, performs endianness
 * conversion if needed, throws if invalid
 * @param {Uint8Array} prop - Entity state binary payload.
 * @param {integer} expectedEndiannessCue - Expected endianness cue.
 * @param {integer} oppositeEndiannessCue - Opposite endianness cue.
 * @return {Uint8Array} Valid binary payload for prop data
 */
function validatePropData(prop,
    expectedEndiannessCue = localEndiannessCue,
    oppositeEndiannessCue = otherEndiannessCue) {
  // Validate payload type
  if (! prop instanceof Uint8Array) {
    throw new Error('Invalid payload type for prop data');
  }

  // Validate payload length
  if (prop.length < propDataMinSize) {
    throw new Error('Invalid payload length for prop data');
  }

  let validProp = prop;

  const endiannessCue = (new Uint32Array(prop.buffer, 0, 1))[0];

  if (endiannessCue != expectedEndiannessCue) {
    if (endiannessCue != oppositeEndiannessCue) {
      throw new Error('Unknown endian for prop data payload');
    }

    // Mismatching endianness: flip everything
    validProp = flipPropDataEndian(prop);
  }

  return validProp;
}

/**
 * Deserialize binary payload of prop data
 * @param {Uint8Array} prop - Prop data binary payload.
 * @return {Prop} Prop data in object form
 */
function deserializeProp(prop) {
  const validProp = validatePropData(prop);
  const encoder = new TextDecoder();

  const uShortArray = new Uint16Array(validProp.buffer, 0, 33);
  const uIntArray = new Uint32Array(validProp.buffer, 0, 16);
  const uLongArray = new BigUint64Array(validProp.buffer, 0, 8);
  const floatArray = new Float32Array(validProp.buffer, 0, 16);
  const doubleArray = new Float64Array(validProp.buffer, 0, 8);

  const id = uIntArray[1];
  const worldId = uIntArray[2];
  const userId = uIntArray[3];
  const date = uLongArray[2];
  const x = doubleArray[3];
  const y = doubleArray[4];
  const z = doubleArray[5];
  const yaw = floatArray[12];
  const pitch = floatArray[13];
  const roll = floatArray[14];
  const nameLength = uShortArray[30];
  const descriptionLength = uShortArray[31];

  const name = encoder.decode(validProp.slice(propDataSchema.data[0],
      propDataSchema.data[0] + nameLength));
  const description = encoder.decode(validProp.slice(propDataSchema.data[0] +
      nameLength, propDataSchema.data[0] + nameLength + descriptionLength));
  const action = encoder.decode(validProp.slice(propDataSchema.data[0] +
      nameLength + descriptionLength));

  return new Prop(id, worldId, userId, date, x, y, z,
      yaw, pitch, roll, name, description, action);
}

/**
 * Pack several prop data entries into a single payload
 * @param {Array<Uint8Array>} propEntries - Array of prop data payloads.
 * @return {Uint8Array} Prop data binary payload pack
 */
function packPropData(propEntries) {
  // Compute the total size of all prop data entries, as well as the offsets
  // for each one of them
  let size = 0;
  const offsets = [];

  for (const prop of propEntries) {
    offsets.push(size);
    size += prop.length;
  }

  const propDataPack = new Uint8Array(8 + size);

  const uIntArray = new Uint32Array(propDataPack.buffer, 0, 2);
  uIntArray[0] = localEndiannessCue; // Start with the endianness cue...
  uIntArray[1] = propEntries.length; // ...followed by the number of entries

  propEntries.forEach((prop, i) => {
    propDataPack.set(validatePropData(prop), 8 + offsets[i]);
  });

  return propDataPack;
}

/**
 * Validate binary payload of prop data pack, throws if invalid,
 * return endian-correct number of entries in the pack
 * @param {Uint8Array} propDataPack - Prop data pack binary payload.
 * @param {integer} expectedEndiannessCue - Expected endianness cue.
 * @param {integer} oppositeEndiannessCue - Opposite endianness cue.
 * @return {integer} Number of entries in the pack
 */
function validatePropDataPack(propDataPack,
    expectedEndiannessCue = localEndiannessCue,
    oppositeEndiannessCue = otherEndiannessCue) {
  // Validate payload type
  if (! propDataPack instanceof Uint8Array) {
    throw new Error('Invalid payload type for prop data pack');
  }

  const uIntArray = new Uint32Array(propDataPack.buffer, 0, 2);

  const endiannessCue = uIntArray[0];
  let nbPropEntries = uIntArray[1];

  if (endiannessCue != expectedEndiannessCue) {
    if (endiannessCue != oppositeEndiannessCue) {
      throw new Error('Unknown endian for prop data pack payload');
    }

    const newUint8 = new Uint8Array(4);

    newUint8[0] = propDataPack[7];
    newUint8[1] = propDataPack[6];
    newUint8[2] = propDataPack[5];
    newUint8[3] = propDataPack[4];

    nbPropEntries = (new Uint32Array(newUint8.buffer))[0];
  }

  return nbPropEntries;
}

/**
 * Unpack prop data payload bundle into an array of individual payloads
 * @param {Uint8Array} propDataPack - Prop data payload pack
 * @return {Array<Uint8Array>} Array of prop data payloads.
 */
function unpackPropData(propDataPack) {
  const nbPropEntries = validatePropDataPack(propDataPack);

  if (propDataPack.length < (8 + nbPropEntries * propDataMinSize)) {
    throw new Error('Invalid payload pack size');
  }

  const propEntries = [];
  let begin = 8;
  let end = 0;

  for (let i = 0; i < nbPropEntries; i++) {
    const lengthFields = new Uint16Array(propDataPack.slice(begin +
        propDataSchema.nameLength[0]).buffer);

    // The total size of a any single entry needs to be known
    // by inspecting the values from the length fields
    const size = propDataMinSize + lengthFields[0] + lengthFields[1] +
        lengthFields[2];
    end = begin + size;

    const prop = new Uint8Array(propDataPack
        .slice(begin, end).buffer);

    propEntries.push(validatePropData(prop));
    begin = end;
  }

  return propEntries;
}

/**
 * Get the hash of a list of props
 * @param {Array<Prop>} props - List of props to hash.
 * @return {integer} Hash of the prop list (32 bits).
 */
function hashProps(props) {
  const mask = 0xffffffff; // 32 bits
  let hash = 0;

  const sorted =
      [...props].sort((a, b) => (a.id < b.id) ? -1 :
      ((a.id > b.id) ? 1 : 0));

  for (const {date} of sorted) {
    hash = (hash << 5) - hash + parseInt(date);
    hash = hash & hash; // Prevent overflow
  }

  return hash & mask;
}

export {serializeProp, deserializeProp, packPropData,
  unpackPropData, propDataMinSize, validatePropData,
  validatePropDataPack, hashProps};
