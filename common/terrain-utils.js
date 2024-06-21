/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

const zeroElevationValue = parseInt(0xffff / 2);
const pointDisabledValue = 254; // Same as AW Elevdump files
const defaultPageDiameter = 128; // In number of points

const localEndiannessCue = 0x1144;
const otherEndiannessCue = 0x4411;

const pageAssetName = 'page';
const pointsAssetName = 'points';
const wireframeAssetName = 'wireframe';
const actualAssetName = 'actual';

/**
 * @typedef PageCoordinates
 * @type {object}
 * @property {number} pageX - X-axis index for the page.
 * @property {number} pageZ - Z-axis index for the page.
 * @property {integer} offsetX - Offset to target a specific entry in the data
 *                               array along the X-axis.
 * @property {integer} offsetZ - Offset to target a specific entry in the data
 *                               array along the Z-axis.
 */

/**
 * @typedef ElevationData
 * @type {Uint16Array}
 *
 * @description
 * The elevation data array encodes the whole elevation for a single
 * terrain page.
 *
 * By default (and per AW specifications): a terrain page contains
 * 128*128 nodes with 10 meters spacing between them along each axis,
 * so a whole terrain page is meant to be 1280 meters long (Z-axis)
 * and 1280 meters large (X-axis).
 *
 * The height is encoded on 16 bits (unsigned), and is expressed in
 * centimeters, the base level (altitude 0m relative to this page)
 * is half the maximum value a 16-bit unsigned integer can hold:
 * 0x7fff in hexadecimal, which is 32767 in decimal.
 *
 * Going below this value means going under altitude 0m: 32766
 * is -1cm, 32765 is -2cm, etc.
 *
 * Going above means going over altitude 0m: 32768 is +1cm,
 * 32769 is +2cm, etc.
 */

/**
 * @typedef TextureData
 * @type {Uint16Array}
 *
 * @description
 * The texture data array encodes the whole texture information for a
 * single terrain page, it matches the dimensions of {@link ElevationData}.
 *
 * Matching the original AW elevation dump file format: a single point texture,
 * its rotation and its enabling are all encoded in a single byte.
 *
 * The highest two order bits encode the rotation this makes it 4 possible
 * values (going counter-clockwise, rotating left).
 * The remaining amount of bits (6 of them) simply encode the ID of the
 * texture.
 *
 * When a point is disabled (hole): the whole byte is set to 254.
 */


/**
  * Get page name for given coordinates
  * @param {integer} pageX - X coordinate of the page.
  * @param {integer} pageZ - Z coordinate of the page.
  * @return {string} Name of the page
  */
function getPageName(pageX, pageZ) {
  const x = parseInt(pageX);
  const z = parseInt(pageZ);

  if (isNaN(x) || isNaN(z) || x !== pageX || z !== pageZ) {
    throw new Error('Input coordinates must be valid integers');
  }

  return `${x}_${z}`;
}

/**
  * Get the enabling of a point from its texture data
  * @param {integer} value - Texture data value for this point.
  * @return {boolean} Whether or not the point is enabled, false
  *                   means it's a hole
  */
function isPointEnabled(value) {
  return value != pointDisabledValue;
}

/**
  * Get the texture ID of a point from its texture data
  * @param {integer} value - Texture data value for this point.
  * @return {integer} ID of the texture.
  */
function getPointTexture(value) {
  return value & 0x3f;
}

/**
  * Get the rotation value of a point from its texture data
  * @param {integer} value - Texture data value for this point.
  * @return {integer} Number of counter-clockwise 90° rotations.
  */
function getPointRotation(value) {
  return (value >> 6) & 0x03;
}

/**
 * Flip endian on entity state binary payload, for internal use only
 * @param {Uint8Array} elevationData - Elevation data binary payload.
 * @return {Uint8Array} Endian-flipped binary payload for elevation.
 */
function flipElevationDataEndian(elevationData) {
  const flippedElevation = new Uint8Array(elevationData.length);

  for (let i = 0; i < elevationData.length; i+=2) {
    flippedElevation[i] = elevationData[i + 1];
  }

  return flippedElevation;
}

/**
 * Validate binary payload of elevation data, performs endianness
 * conversion if needed, throws if invalid
 * @param {Uint8Array} packedElevationData - Elevation data binary payload.
 * @param {integer} expectedEndiannessCue - Expected endianness cue.
 * @param {integer} oppositeEndiannessCue - Opposite endianness cue.
 * @return {Uint8Array} Valid binary payload for elevation data
 */
function validateElevationData(packedElevationData,
    expectedEndiannessCue = localEndiannessCue,
    oppositeEndiannessCue = otherEndiannessCue) {
  // Validate payload type
  if (! packedElevationData instanceof Uint8Array) {
    throw new Error('Invalid payload type for elevation data');
  }

  // Validate payload length
  if (packedElevationData.length !=
      (defaultPageDiameter * defaultPageDiameter * 2 + 2)) {
    throw new Error('Invalid payload length for elevation data');
  }

  let validElevationData = packedElevationData;

  const endiannessCue = (new Uint16Array(packedElevationData.buffer))[0];

  if (endiannessCue != expectedEndiannessCue) {
    if (endiannessCue != oppositeEndiannessCue) {
      throw new Error('Unknown endian for elevation data payload');
    }

    // Mismatching endianness: flip everything
    validElevationData = flipElevationDataEndian(validElevationData);
  }

  return validElevationData;
}

/**
 * Unpack elevation values from binary payload
 * @param {Uint8Array} packedElevationData - Elevation data binary payload.
 * @return {ElevationData} Unpacked elevation values, 16-bit entries
 */
function unpackElevationData(packedElevationData) {
  // Get rid of the endianess cue
  return new Uint16Array(validateElevationData(packedElevationData)
      .slice(2).buffer);
}

/**
 * Pack elevation values into binary payload
 * @param {Uint16Array} elevationData - Unpacked elevation values, 16-bit each.
 * @return {TextureData} Elevation data binary payload
 */
function packElevationData(elevationData) {
  const packedElevationData = new Uint8Array(elevationData.length * 2 + 2);
  const uShortArray = new Uint16Array(packedElevationData.buffer);
  uShortArray[0] = localEndiannessCue; // Start with the endianness cue
  uShortArray.set(new Uint16Array(elevationData.buffer), 1);

  return packedElevationData;
}

export {zeroElevationValue, getPageName, isPointEnabled, getPointTexture,
  getPointRotation, pointDisabledValue, defaultPageDiameter,
  unpackElevationData, packElevationData, pageAssetName,
  pointsAssetName, wireframeAssetName, actualAssetName};
