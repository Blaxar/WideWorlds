/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import * as THREE from 'three';

const defaultSkyColors = [
  0.2, 1.0, 1.0, // north
  0.8, 0.9, 0.2, // east
  0.3, 0.5, 7.0, // south
  1.0, 0.2, 1.0, // west
  0.0, 1.0, 1.0, // top
  1.0, 1.0, 0.0, // bottom
];

/**
 * Make a reversed (inward-facing faces) 3D octahedron
 * @param {array} colors - Array of colors, 18 elements
 * @return {Mesh} three.js Mesh object
 */
function makeReversedOctahedron(
    colors = defaultSkyColors) {
  const bufferGeometry = new THREE.BufferGeometry();

  // 6 vertices to make an octahedron
  const positions = [
    0.0, 0.0, -1.0, // north vertice (0)
    1.0, 0.0, 0.0, // east vertice (1)
    0.0, 0.0, 1.0, // south vertice (2)
    -1.0, 0.0, 0.0, // west vertice (3)
    0.0, 1.0, 0.0, // top vertice (4)
    0.0, -1.0, 0.0, // bottom vertice (5)
  ];

  bufferGeometry.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(positions), 3));
  bufferGeometry.setAttribute('color',
      new THREE.BufferAttribute(new Float32Array(colors), 3));

  // 8 triangle faces to make an octahedron
  bufferGeometry.setIndex([4, 0, 1, // top north east face
    4, 1, 2, // top south east face
    4, 2, 3, // top south west face
    4, 3, 0, // top north west face
    5, 1, 0, // bottom north east face
    5, 2, 1, // bottom south east face
    5, 3, 2, // bottom south west face
    5, 0, 3, // bottom north west face
  ]);

  return new THREE.Mesh(bufferGeometry,
      new THREE.MeshBasicMaterial({vertexColors: true}));
}

/**
 * Flips the radians to the opposite angle
 * @param {number} yaw - The Yaw in Radians
 * @return {number} - Returns the opposite radian angle
 */
function flipYawRadians(yaw) {
  return (2 * Math.PI - yaw) % (2 * Math.PI);
}

/**
 * Flips the degrees to the opposite angle
 * @param {number} yaw - The Yaw in Degrees
 * @return {number} - Returns the opposite degree angle
 */
function flipYawDegrees(yaw) {
  const result = (180 - yaw) % 360;
  return result < 0 ? result + 360 : result;
}

/**
 * Build 3D asset for helper arrows
 * @return {Group} three.js group entity holding the arrows.
 */
function makeHelperArrows() {
  const arrows = new THREE.Group();

  // Make X axis
  const xMaterial = new THREE.LineBasicMaterial( {color: 0xff0000} );
  const xArrowGeometry = new THREE.BufferGeometry().setFromPoints(
      [
        new THREE.Vector3(0.0, 0.0, 0.0),
        new THREE.Vector3(2.0, 0.0, 0.0),
        new THREE.Vector3(1.75, 0.25, 0.0),
        new THREE.Vector3(1.75, -0.25, 0.0),
        new THREE.Vector3(2.0, 0.0, 0.0),
      ]);
  const xSignGeometry = new THREE.BufferGeometry().setFromPoints(
      [
        new THREE.Vector3(2.15, -0.25, 0.0),
        new THREE.Vector3(2.45, 0.25, 0.0),
        new THREE.Vector3(2.3, 0.0, 0.0),
        new THREE.Vector3(2.15, 0.25, 0.0),
        new THREE.Vector3(2.45, -0.25, 0.0),
      ]);
  const xAxis = new THREE.Line(xArrowGeometry, xMaterial);
  const xSign = new THREE.Line(xSignGeometry, xMaterial);

  // Make Y axis
  const yMaterial = new THREE.LineBasicMaterial( {color: 0x00ff00} );
  const yArrowGeometry = new THREE.BufferGeometry().setFromPoints(
      [
        new THREE.Vector3(0.0, 0.0, 0.0),
        new THREE.Vector3(0.0, 2.0, 0.0),
        new THREE.Vector3(0.25, 1.75, 0.0),
        new THREE.Vector3(-0.25, 1.75, 0.0),
        new THREE.Vector3(0.0, 2.0, 0.0),
      ]);
  const ySignGeometry = new THREE.BufferGeometry().setFromPoints(
      [
        new THREE.Vector3(0.0, 2.1, 0.0),
        new THREE.Vector3(0.0, 2.3, 0.0),
        new THREE.Vector3(-0.20, 2.5, 0.0),
        new THREE.Vector3(0.0, 2.3, 0.0),
        new THREE.Vector3(0.20, 2.5, 0.0),
      ]);
  const yAxis = new THREE.Line(yArrowGeometry, yMaterial);
  const ySign = new THREE.Line(ySignGeometry, yMaterial);

  // Make Z axis
  const zMaterial = new THREE.LineBasicMaterial( {color: 0x0000ff} );
  const zArrowGeometry = new THREE.BufferGeometry().setFromPoints(
      [
        new THREE.Vector3(0.0, 0.0, 0.0),
        new THREE.Vector3(0.0, 0.0, 2.0),
        new THREE.Vector3(0.0, 0.25, 1.75),
        new THREE.Vector3(0.0, -0.25, 1.75),
        new THREE.Vector3(0.0, 0.0, 2.0),
      ]);
  const zSignGeometry = new THREE.BufferGeometry().setFromPoints(
      [
        new THREE.Vector3(0.0, 0.25, 2.45),
        new THREE.Vector3(0.0, 0.25, 2.15),
        new THREE.Vector3(0.0, -0.25, 2.45),
        new THREE.Vector3(0.0, -0.25, 2.15),
      ]);
  const zAxis = new THREE.Line(zArrowGeometry, zMaterial);
  const zSign = new THREE.Line(zSignGeometry, zMaterial);

  arrows.add(xAxis, xSign, yAxis, ySign, zAxis, zSign);

  return arrows;
}

export {makeReversedOctahedron, defaultSkyColors,
  makeHelperArrows, flipYawRadians, flipYawDegrees};
