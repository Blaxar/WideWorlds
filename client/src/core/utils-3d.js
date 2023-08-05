/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {zeroElevationValue, isPointEnabled, getPointTexture,
  getPointRotation} from '../../../common/terrain-utils.js';
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

// TODO: tweak terrain light properties based on world settings
const defaultAmbient = new THREE.Color(0.69, 0.69, 0.69);
const defaultSpecular = 0x000000;

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

  const materialProperties = {
    color: defaultAmbient,
    specular: defaultSpecular,
    shininess: 0,
  };

  for (let i = 0; i < maxNbTerrainTextures; i++) {
    const texturePath = `${path}/terrain${i}.jpg`;
    const baseTexture = new THREE.TextureLoader().load(texturePath);
    baseTexture.matrixAutoUpdate = false;
    baseTexture.wrapS = THREE.RepeatWrapping;
    baseTexture.wrapT = THREE.RepeatWrapping;
    baseTexture.colorSpace = THREE.SRGBColorSpace;

    // Generate the 3 remaining levels of rotation
    const rot90Texture = baseTexture.clone();
    rot90Texture.rotation = Math.PI * 0.5;
    rot90Texture.updateMatrix();

    const rot180Texture = baseTexture.clone();
    rot180Texture.rotation = Math.PI;
    rot180Texture.updateMatrix();

    const rot270Texture = baseTexture.clone();
    rot270Texture.rotation = Math.PI * 1.5;
    rot270Texture.updateMatrix();

    // Make the materials
    const baseMaterial = new THREE.MeshPhongMaterial(Object.assign({
      map: baseTexture,
    }, materialProperties));

    const rot90Material = new THREE.MeshPhongMaterial(Object.assign({
      map: rot90Texture,
    }, materialProperties));

    const rot180Material = new THREE.MeshPhongMaterial(Object.assign({
      map: rot180Texture,
    }, materialProperties));

    const rot270Material = new THREE.MeshPhongMaterial(Object.assign({
      map: rot270Texture,
    }, materialProperties));

    materials.push([baseMaterial, rot90Material, rot180Material,
      rot270Material]);
  }

  return materials;
}

/**
 * Make 3D asset for a single page from provided elevation and texture data
 * @param {Uint16array} elevationData - Raw elevation data for the whole page.
 * @param {Uint8array} textureData - Raw texture data for the whole page.
 * @param {integer} sideSize - Length of the page side in real space.
 * @param {integer} nbSegments - Number of segments on both X and Z axis.
 * @param {Array<Array<Material>>} terrainMaterials - Terrain materials.
 * @param {string} name - Name to assign to the resulting 3D asset.
 * @return {Object3D} 3D asset for the terrain page
 */
function makePagePlane(elevationData, textureData, sideSize, nbSegments,
    terrainMaterials, name = 'page') {
  const pageGeometry = new THREE.BufferGeometry();
  const nbBufferEntries = (nbSegments + 1) * (nbSegments + 1);
  const positions = new Float32Array(nbBufferEntries * 3);
  const uvs = new Float32Array(nbBufferEntries * 2);
  const faces = [];

  const posStride = (nbSegments + 1) * 3;
  const uvStride = (nbSegments + 1) * 2;

  const geometryMaterials = []; // This will store IDs first

  const getMaterialPos = (textureValue) => {
    for (const [id, value] of geometryMaterials.entries()) {
      if (value == textureValue) return id;
    }

    geometryMaterials.push(textureValue);
    return geometryMaterials.length - 1;
  };

  // We'll need to track of the current material group
  let groupStart = 0;
  let groupLength = 0;
  let groupMaterialId = 0;
  const groupDataPerPoint = 2 * 3;

  // Ready base grid geometry
  for (let x = 0; x < nbSegments + 1; x++) {
    const posX = (x - (nbSegments / 2)) * (sideSize / nbSegments);

    for (let z = 0; z < nbSegments + 1; z++) {
      const posZ = (z - (nbSegments / 2)) * (sideSize / nbSegments);

      positions[z * posStride + x * 3] = posX;
      positions[z * posStride + x * 3 + 1] =
          - zeroElevationValue / 100.0;
      positions[z * posStride + x * 3 + 2] = posZ;

      uvs[z * uvStride + x * 2] = x;
      uvs[z * uvStride + x * 2 + 1] = (nbSegments + 1) - z;
    }
  }

  // Update geometry from provided elevation and texture data
  for (let x = 0; x < nbSegments; x++) {
    for (let z = 0; z < nbSegments; z++) {
      const dataId = z * nbSegments + x;

      // Set height from position data
      positions[z * posStride + x * 3 + 1] =
          (elevationData[dataId] - zeroElevationValue) / 100.0;

      const textureValue = textureData[dataId];

      // If it's a hole: nothing else to do
      if (!isPointEnabled(textureValue)) continue;

      // Otherwise: go ahead and create the face
      if ((x + (z % 2) ) % 2) {
        faces.push(
            z * (nbSegments + 1) + x,
            (z + 1) * (nbSegments + 1) + x,
            z * (nbSegments + 1) + x + 1,
            z * (nbSegments + 1) + x + 1,
            (z + 1) * (nbSegments + 1) + x,
            (z + 1) * (nbSegments + 1) + x + 1,
        );
      } else {
        faces.push(
            z * (nbSegments + 1) + x,
            (z + 1) * (nbSegments + 1) + x,
            (z + 1) * (nbSegments + 1) + x + 1,
            z * (nbSegments + 1) + x,
            (z + 1) * (nbSegments + 1) + x + 1,
            z * (nbSegments + 1) + x + 1,
        );
      }

      // Handle material group down there
      const materialId = getMaterialPos(textureValue);

      if (groupMaterialId == materialId) {
        groupLength += groupDataPerPoint;
      } else {
        pageGeometry.addGroup(groupStart, groupLength,
            groupMaterialId);
        groupStart += groupLength;
        groupLength = groupDataPerPoint;
        groupMaterialId = materialId;
      }
    }
  }

  pageGeometry.addGroup(groupStart, groupLength,
      groupMaterialId);

  const finalMaterials = geometryMaterials.map((textureValue) => {
    // Now: replace each texture value with its corresponding material
    const textureId = getPointTexture(textureValue);
    const rotId = getPointRotation(textureValue);

    return terrainMaterials[textureId][rotId];
  });

  pageGeometry.setAttribute('position',
      new THREE.BufferAttribute(positions, 3));
  pageGeometry.setAttribute('uv',
      new THREE.BufferAttribute(uvs, 2));
  pageGeometry.setIndex(faces);
  pageGeometry.computeVertexNormals();

  const page = new THREE.Mesh(
      pageGeometry,
      finalMaterials,
  );

  page.name = name;

  return page;
}

/**
 * Adjust edges for the page and its surroundings
 * @param {Object3D} pagePlane - 3D plane for the page, as built by
 *                               makePagePlane.
 * @param {Uint16array} elevationData - Elevation data for the target page.
 * @param {Object3D} left - 3D plane for the left page (if any).
 * @param {Object3D} topLeft - 3D plane for the top-left page (if any).
 * @param {Object3D} top - 3D plane for the top page (if any).
 * @param {Uint16array} right - Elevation data for the right page (if any).
 * @param {Uint16array} bottomRight - Elevation data for the bottom-right page
 *                                    (if any).
 * @param {Uint16array} bottom - Elevation data for the bottom page (if any).
 * @param {integer} nbSegments - Number of segments on both X and Z axis.
 */
function adjustPageEdges(pagePlane, elevationData, left, topLeft, top, right,
    bottomRight, bottom, nbSegments) {
  const centerPositions = pagePlane.geometry.getAttribute('position').array;
  const topLeftPositions = topLeft ?
      topLeft.geometry.getAttribute('position').array : null;
  const topPositions = top ?
      top.geometry.getAttribute('position').array : null;
  const leftPositions = left ?
      left.geometry.getAttribute('position').array : null;
  const posStride = (nbSegments + 1) * 3;

  // Adjust other planes first, starting
  // with the top-left one (-1,-1)
  if (topLeftPositions) {
    topLeftPositions[nbSegments * posStride + nbSegments * 3 + 1] =
        (elevationData[0] - zeroElevationValue) / 100.0;
  }

  // Then the left (-1, 0) and top (0, -1) ones
  for (let i = 0; i < nbSegments; i++) {
    if (leftPositions) {
      leftPositions[i * posStride + nbSegments * 3 + 1] =
          (elevationData[i * nbSegments] - zeroElevationValue) / 100.0;
    }

    if (topPositions) {
      topPositions[nbSegments * posStride + i * 3 + 1] =
          (elevationData[i] - zeroElevationValue) / 100.0;
    }
  }

  // Second: adjust the target plane itself, staring with
  // the bottom-right data (1, 1)
  if (bottomRight) {
    centerPositions[nbSegments * posStride + nbSegments * 3 + 1] =
        (bottomRight[0]- zeroElevationValue) / 100.0;
  }

  // Then the right (1, 0) and bottom (0, 1) ones
  for (let i = 0; i < nbSegments; i++) {
    if (right) {
      centerPositions[i * posStride + nbSegments * 3 + 1] =
          (right[i * nbSegments] - zeroElevationValue) / 100.0;
    }

    if (bottom) {
      centerPositions[nbSegments * posStride + i * 3 + 1] =
          (bottom[i] - zeroElevationValue) / 100.0;
    }
  }

  if (topLeft) {
    topLeft.geometry.computeVertexNormals();
    topLeft.geometry.getAttribute('position').needsUpdate = true;
  }

  if (top) {
    top.geometry.computeVertexNormals();
    top.geometry.getAttribute('position').needsUpdate = true;
  }

  if (left) {
    left.geometry.computeVertexNormals();
    left.geometry.getAttribute('position').needsUpdate = true;
  }

  pagePlane.geometry.computeVertexNormals();
  pagePlane.geometry.getAttribute('position').needsUpdate = true;
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

export {makeReversedOctahedron, defaultSkyColors, generateTerrainMaterials,
  makePagePlane, adjustPageEdges, makeHelperArrows};
