/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

const zeroElevationValue = 0xffff / 2;
const pointDisabledValue = 254; // Same as AW Elevdump files

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

export {zeroElevationValue, getPageName, isPointEnabled,
  getPointTexture, getPointRotation, pointDisabledValue};
