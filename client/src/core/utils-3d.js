/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {zeroElevationValue} from '../../../common/terrain-utils.js';
import * as THREE from 'three';

const maxNbTerrainTextures = 62;

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
    0.0, 0.0, 1.0, // north vertice (0)
    -1.0, 0.0, 0.0, // east vertice (1)
    0.0, 0.0, -1.0, // south vertice (2)
    1.0, 0.0, 0.0, // west vertice (3)
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
 * Generate all possible terrain tile textures
 * @param {string} path - Path to the folder holding terrain textures
 * @return {Array<Array<Material>>} Array of arrays: 4 rotation
 *                                  variations for each texture
 */
function generateTerrainMaterials(path) {
  const materials = [];

  for (let i = 0; i < maxNbTerrainTextures; i++) {
    const texturePath = `${path}/terrain${i}.jpg`;
    const baseTexture = new THREE.TextureLoader().load(texturePath);
    baseTexture.matrixAutoUpdate = false;
    baseTexture.wrapS = THREE.RepeatWrapping;
    baseTexture.wrapT = THREE.RepeatWrapping;

    // Generate the 3 remaining levels of rotation
    const rot90Texture = baseTexture.clone();
    rot90Texture.rotation = Math.PI / 2;
    rot90Texture.updateMatrix();

    const rot180Texture = baseTexture.clone();
    rot180Texture.rotation = Math.PI;
    rot180Texture.updateMatrix();

    const rot270Texture = baseTexture.clone();
    rot270Texture.rotation = Math.PI * 1.5;
    rot270Texture.updateMatrix();

    // Make the materials
    const baseMaterial = new THREE.MeshPhongMaterial({
      map: baseTexture,
    });

    const rot90Material = new THREE.MeshPhongMaterial({
      map: rot90Texture,
    });

    const rot180Material = new THREE.MeshPhongMaterial({
      map: rot180Texture,
    });

    const rot270Material = new THREE.MeshPhongMaterial({
      map: rot270Texture,
    });

    materials.push([baseMaterial, rot90Material, rot180Material,
      rot270Material]);
  }

  return materials;
}

/**
 * Generate all possible terrain tile textures
 * @param {Uint16array} elevationData - Raw elevation data for the whole page0
 * @param {Uint16array} textureData - Raw texture data for the whole page.
 * @param {integer} sideSize - Length of the page side in real space.
 * @param {integer} nbSegments - Number of segments on both X and Z axis.
 * @param {Array<Array<Material>>} terrainMaterials - Terrain materials.
 * @return {Object3D} 3D asset for the terrain page
 */
function makePagePlane(elevationData, textureData, sideSize, nbSegments,
    terrainMaterials) {
  const planeGeometry = new THREE.PlaneGeometry(sideSize, sideSize,
      nbSegments, nbSegments);
  const positions = planeGeometry.getAttribute('position').array;
  const uvs = planeGeometry.getAttribute('uv').array;

  const posStride = (nbSegments + 1) * 3;
  const uvStride = (nbSegments + 1) * 2;

  // Update geometry from provided elevation and texture data
  for (let x = 0; x < nbSegments; x++) {
    for (let z = 0; z < nbSegments; z++) {
      positions[z * posStride + x * 3 + 2] =
          (elevationData[z * nbSegments + x] - zeroElevationValue) / 100.0;
      uvs[z * uvStride + x * 2] = nbSegments - x;
      uvs[z * uvStride + x * 2 + 1] = z;

      // TODO: apply different materials for each face
    }
  }

  const plane = new THREE.Mesh(
      planeGeometry,
      terrainMaterials[0][0], // TODO: use different materials and groups
  );
  plane.rotateX(-Math.PI / 2);

  return plane;
}

export {makeReversedOctahedron, defaultSkyColors, generateTerrainMaterials,
  makePagePlane};
