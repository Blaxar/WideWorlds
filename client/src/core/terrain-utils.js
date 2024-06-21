/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {zeroElevationValue, isPointEnabled, getPointTexture,
  getPointRotation, pageAssetName, pointsAssetName,
  wireframeAssetName, actualAssetName}
  from '../../../common/terrain-utils.js';
import * as THREE from 'three';

const maxNbTerrainTextures = 62;

// TODO: tweak terrain light properties based on world settings
const defaultAmbient = new THREE.Color(0.69, 0.69, 0.69);
const defaultSpecular = 0x000000;

const topLeftPositionOffset = 0;
const topRightPositionOffset = 3;
const bottomLeftPositionOffset = 6;
const bottomRightPositionOffset = 9;

const topLeftUvOffset = 0;
const topRightUvOffset = 2;
const bottomLeftUvOffset = 4;
const bottomRightUvOffset = 6;

const topLeftNormalOffset = 0;
const topRightNormalOffset = 3;
const bottomLeftNormalOffset = 6;
const bottomRightNormalOffset = 9;

const wireframeMaterial = new THREE.MeshBasicMaterial(
    {color: 0x00ff00, wireframe: true},
);
const pointMaterial = new THREE.PointsMaterial(
    {color: 0xff0000, size: 0.2},
);

// Filter to use when computing bounds tree on the terrain page:
// only the actual page geometry should be used, not the wireframe
// and points cloud overlays
const pageNodeCollisionPreSelector = (obj3d) =>
  obj3d.getObjectByName(pageAssetName)
      .userData.lookup.actual;

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
    baseTexture.wrapS = THREE.ClampToEdgeWrapping;
    baseTexture.wrapT = THREE.ClampToEdgeWrapping;
    baseTexture.colorSpace = THREE.SRGBColorSpace;
    baseTexture.center.set(0.5, 0.5);
    baseTexture.updateMatrix();

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
 * Initialize all the vertex data for the actual visible terrain page,
 * for internal use by {@link makePagePlane}
 * @param {Float32Array} actualPositions - Array of vertex positions.
 * @param {integer} posActualStride - Offset to jump by in the position array
 *                                    in order to reach the terrain tile just
 *                                    below.
 * @param {number} sideSize - Real-space length (in meters) of the page side.
 * @param {Float32Array} actualUVs - Array of vertex UVs.
 * @param {integer} uvActualStride - Offset to jump by in the UV array in order
 *                                   to reach the terrain tile just below.
 * @param {integer} nbSegments - Number of tile segments to split each side/axis
 *                               of the page by.
 */
function initializeActualPageVertices(actualPositions, posActualStride,
    sideSize, actualUVs, uvActualStride, nbSegments) {
  for (let x = 0; x < nbSegments; x++) {
    for (let z = 0; z < nbSegments; z++) {
      const leftPosX = (x - (nbSegments / 2)) * (sideSize / nbSegments);
      const topPosZ = (z - (nbSegments / 2)) * (sideSize / nbSegments);
      const rightPosX = (x + 1 - (nbSegments / 2)) * (sideSize / nbSegments);
      const bottomPosZ = (z + 1 - (nbSegments / 2)) * (sideSize / nbSegments);

      // Top left vertex
      actualPositions[z * posActualStride + x * 12 +
          topLeftPositionOffset] = leftPosX;
      actualPositions[z * posActualStride + x * 12 +
          topLeftPositionOffset + 1] = 0;
      actualPositions[z * posActualStride + x * 12 +
          topLeftPositionOffset + 2] = topPosZ;
      actualUVs[z * uvActualStride + x * 8 +
          topLeftUvOffset] = 0;
      actualUVs[z * uvActualStride + x * 8 +
          topLeftUvOffset + 1] = 1;

      // Top right vertex
      actualPositions[z * posActualStride + x * 12 +
          topRightPositionOffset] = rightPosX;
      actualPositions[z * posActualStride + x * 12 +
          topRightPositionOffset + 1] = 0;
      actualPositions[z * posActualStride + x * 12 +
          topRightPositionOffset + 2] = topPosZ;
      actualUVs[z * uvActualStride + x * 8 +
          topRightUvOffset] = 1;
      actualUVs[z * uvActualStride + x * 8 +
          topRightUvOffset + 1] = 1;

      // Bottom left vertex
      actualPositions[z * posActualStride + x * 12 +
          bottomLeftPositionOffset] = leftPosX;
      actualPositions[z * posActualStride + x * 12 +
          bottomLeftPositionOffset + 1] = 0;
      actualPositions[z * posActualStride + x * 12 +
          bottomLeftPositionOffset + 2] = bottomPosZ;
      actualUVs[z * uvActualStride + x * 8 +
          bottomLeftUvOffset] = 0;
      actualUVs[z * uvActualStride + x * 8 +
          bottomLeftUvOffset + 1] = 0;

      // Bottom right vertex
      actualPositions[z * posActualStride + x * 12 +
          bottomRightPositionOffset] = rightPosX;
      actualPositions[z * posActualStride + x * 12 +
          bottomRightPositionOffset + 1] = 0;
      actualPositions[z * posActualStride + x * 12 +
          bottomRightPositionOffset + 2] = bottomPosZ;
      actualUVs[z * uvActualStride + x * 8 +
          bottomRightUvOffset] = 1;
      actualUVs[z * uvActualStride + x * 8 +
          bottomRightUvOffset + 1] = 0;
    }
  }
}

/**
 * Set the height of a given actual page point, this takes care of
 * updating all the concerned vertices from all affected tiles
 * sharing this point, for internal use by {@link makePagePlane} and
 * {@link adjustPageEdges}
 * @param {Float32Array} actualPositions - Array of vertex positions.
 * @param {integer} posActualStride - Offset to jump by in the position array
 *                                    in order to reach the terrain tile just
 *                                    below.
 * @param {integer} nbSegments - Number of tile segments to split each side/axis
 *                               of the page by.
 * @param {integer} x - X-axis position of the page point to set the height of.
 * @param {integer} z - Z-axis position of the page point to set the height of.
 * @param {integer} height - Raw height value to set on the target point.
 */
function setActualPageVertexHeights(actualPositions, posActualStride,
    nbSegments, x, z, height) {
  // A single height will likely concern 4 vertices on
  // the actual visible page, so we account for that

  // Top left tile, aiming for the bottom right vertex (if applicable)
  if (x > 0 && x <= nbSegments && z > 0 && z <= nbSegments) {
    actualPositions[(z - 1) * posActualStride + (x - 1) * 12 +
        bottomRightPositionOffset + 1] = height;
  }

  // Top tile, aiming for the bottom left vertex (if applicable)
  if (z > 0 && z <= nbSegments && x < nbSegments) {
    actualPositions[(z - 1) * posActualStride + x * 12 +
        bottomLeftPositionOffset + 1] = height;
  }

  // Left tile, aiming for the top right vertex (if applicable)
  if (x > 0 && x <= nbSegments && z < nbSegments) {
    actualPositions[z * posActualStride + (x - 1) * 12 +
        topRightPositionOffset + 1] = height;
  }

  if (x >= nbSegments || z >= nbSegments) return;

  // Actual tile, aiming for the top left vertex
  actualPositions[z * posActualStride + x * 12 +
      topLeftPositionOffset + 1] = height;
};

/**
 * Use the provided wireframe page normals to set the ones on the actual
 * page, this takes care of updating all the concerned vertices from all
 * affected tiles sharing each point on the whole page, for internal use
 * by {@link makePagePlane} and {@link adjustPageEdges}
 * @param {Float32Array} wireframeNormals - Array of vertex normals from
 *                                          the wireframe page.
 * @param {Float32Array} actualNormals - Array of vertex normals for the
 *                                       actual page (to be set).
 * @param {integer} nbSegments - Number of tile segments to split each side/axis
 *                               of the page by.
 */
function syncActualPageNormals(wireframeNormals, actualNormals, nbSegments) {
  const wireframeNormalStride = (nbSegments + 1) * 3;
  const actualNormalStride = nbSegments * 12;

  for (let x = 0; x < nbSegments; x++) {
    for (let z = 0; z < nbSegments; z++) {
      // Top left vertex
      actualNormals[z * actualNormalStride + x * 12 +
          topLeftNormalOffset] =
        wireframeNormals[z * wireframeNormalStride + x * 3];
      actualNormals[z * actualNormalStride + x * 12 +
          topLeftNormalOffset + 1] =
        wireframeNormals[z * wireframeNormalStride + x * 3 + 1];
      actualNormals[z * actualNormalStride + x * 12 +
          topLeftNormalOffset + 2] =
        wireframeNormals[z * wireframeNormalStride + x * 3 + 2];

      // Top right vertex
      actualNormals[z * actualNormalStride + x * 12 +
          topRightNormalOffset] =
        wireframeNormals[z * wireframeNormalStride + (x + 1) * 3];
      actualNormals[z * actualNormalStride + x * 12 +
          topRightNormalOffset + 1] =
        wireframeNormals[z * wireframeNormalStride + (x + 1) * 3 + 1];
      actualNormals[z * actualNormalStride + x * 12 +
          topRightNormalOffset + 2] =
        wireframeNormals[z * wireframeNormalStride + (x + 1) * 3 + 2];


      // Bottom left vertex
      actualNormals[z * actualNormalStride + x * 12 +
          bottomLeftNormalOffset] =
        wireframeNormals[(z + 1) * wireframeNormalStride + x * 3];
      actualNormals[z * actualNormalStride + x * 12 +
          bottomLeftNormalOffset + 1] =
        wireframeNormals[(z + 1) * wireframeNormalStride + x * 3 + 1];
      actualNormals[z * actualNormalStride + x * 12 +
          bottomLeftNormalOffset + 2] =
        wireframeNormals[(z + 1) * wireframeNormalStride + x * 3 + 2];


      // Bottom right vertex
      actualNormals[z * actualNormalStride + x * 12 +
          bottomRightNormalOffset] =
        wireframeNormals[(z + 1) * wireframeNormalStride + (x + 1) * 3];
      actualNormals[z * actualNormalStride + x * 12 +
          bottomRightNormalOffset + 1] =
        wireframeNormals[(z + 1) * wireframeNormalStride + (x + 1) * 3 + 1];
      actualNormals[z * actualNormalStride + x * 12 +
          bottomRightNormalOffset + 2] =
        wireframeNormals[(z + 1) * wireframeNormalStride + (x + 1) * 3 + 2];
    }
  }
}

/**
 * Make 3D asset for a single terrain page from provided elevation and texture
 * data
 * @param {ElevationData} elevationData - Raw elevation data for the whole page.
 * @param {TextureData} textureData - Raw texture data for the whole page.
 * @param {integer} sideSize - Length of the page side in real space.
 * @param {integer} nbSegments - Number of segments on both X and Z axis.
 * @param {Array<Array<Material>>} terrainMaterials - Terrain materials.
 * @return {Object3D} 3D asset for the terrain page
 */
function makePagePlane(elevationData, textureData, sideSize, nbSegments,
    terrainMaterials) {
  const page = new THREE.Group();
  const pageWireframeGeometry = new THREE.BufferGeometry();
  const nbWireframeBufferEntries = (nbSegments + 1) * (nbSegments + 1);
  const wireframePositions = new Float32Array(nbWireframeBufferEntries * 3);
  const wireframeFaces = [];

  // We needs each tile to have each own vertices (not shared with neigbours)
  // since we need to keep the UV values between [0, 1]
  const pageActualGeometry = new THREE.BufferGeometry();
  const nbActualBufferEntries = nbSegments * nbSegments * 4;
  const actualPositions = new Float32Array(nbActualBufferEntries * 3);
  const actualNormals = new Float32Array(nbActualBufferEntries * 3);
  const actualUVs = new Float32Array(nbActualBufferEntries * 2);
  const actualFaces = [];

  const posWireframeStride = (nbSegments + 1) * 3;

  const posActualStride = nbSegments * 12;
  const uvActualStride = nbSegments * 8;

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

      wireframePositions[z * posWireframeStride + x * 3] = posX;
      wireframePositions[z * posWireframeStride + x * 3 + 1] =
          - zeroElevationValue / 100.0;
      wireframePositions[z * posWireframeStride + x * 3 + 2] = posZ;
    }
  }

  // Ready actual geometry
  initializeActualPageVertices(actualPositions, posActualStride, sideSize,
      actualUVs, uvActualStride, nbSegments);

  // Update geometry from provided elevation and texture data
  for (let x = 0; x < nbSegments; x++) {
    for (let z = 0; z < nbSegments; z++) {
      const dataId = z * nbSegments + x;

      // Set height from position data
      const height = (elevationData[dataId] - zeroElevationValue) / 100.0;
      wireframePositions[z * posWireframeStride + x * 3 + 1] = height;

      setActualPageVertexHeights(actualPositions, posActualStride, nbSegments,
          x, z, height);

      const textureValue = textureData[dataId];

      // If it's a hole: nothing else to do
      if (!isPointEnabled(textureValue)) continue;

      // Otherwise: go ahead and create the face
      if ((x + (z % 2) ) % 2) {
        wireframeFaces.push(
            z * (nbSegments + 1) + x,
            (z + 1) * (nbSegments + 1) + x,
            z * (nbSegments + 1) + x + 1,
            z * (nbSegments + 1) + x + 1,
            (z + 1) * (nbSegments + 1) + x,
            (z + 1) * (nbSegments + 1) + x + 1,
        );
        actualFaces.push(
            z * nbSegments * 4 + x * 4,
            z * nbSegments * 4 + x * 4 + 2,
            z * nbSegments * 4 + x * 4 + 1,
            z * nbSegments * 4 + x * 4 + 1,
            z * nbSegments * 4 + x * 4 + 2,
            z * nbSegments * 4 + x * 4 + 3,
        );
      } else {
        wireframeFaces.push(
            z * (nbSegments + 1) + x,
            (z + 1) * (nbSegments + 1) + x,
            (z + 1) * (nbSegments + 1) + x + 1,
            z * (nbSegments + 1) + x,
            (z + 1) * (nbSegments + 1) + x + 1,
            z * (nbSegments + 1) + x + 1,
        );
        actualFaces.push(
            z * nbSegments * 4 + x * 4,
            z * nbSegments * 4 + x * 4 + 2,
            z * nbSegments * 4 + x * 4 + 3,
            z * nbSegments * 4 + x * 4,
            z * nbSegments * 4 + x * 4 + 3,
            z * nbSegments * 4 + x * 4 + 1,
        );
      }

      // Handle material group down there
      const materialId = getMaterialPos(textureValue);

      if (groupMaterialId == materialId) {
        groupLength += groupDataPerPoint;
      } else {
        pageWireframeGeometry.addGroup(groupStart, groupLength,
            groupMaterialId);
        pageActualGeometry.addGroup(groupStart, groupLength,
            groupMaterialId);
        groupStart += groupLength;
        groupLength = groupDataPerPoint;
        groupMaterialId = materialId;
      }
    }
  }

  pageActualGeometry.addGroup(groupStart, groupLength,
      groupMaterialId);

  const finalMaterials = geometryMaterials.map((textureValue) => {
    // Now: replace each texture value with its corresponding material
    const textureId = getPointTexture(textureValue);
    const rotId = getPointRotation(textureValue);

    return terrainMaterials[textureId][rotId];
  });

  pageWireframeGeometry.setAttribute('position',
      new THREE.BufferAttribute(wireframePositions, 3));
  pageWireframeGeometry.setIndex(wireframeFaces);
  pageWireframeGeometry.computeVertexNormals();

  pageActualGeometry.setAttribute('position',
      new THREE.BufferAttribute(actualPositions, 3));
  pageActualGeometry.setAttribute('uv',
      new THREE.BufferAttribute(actualUVs, 2));
  pageActualGeometry.setIndex(actualFaces);
  syncActualPageNormals(pageWireframeGeometry.getAttribute('normal').array,
      actualNormals, nbSegments);
  pageActualGeometry.setAttribute('normal',
      new THREE.BufferAttribute(actualNormals, 3));

  const wireframePage = new THREE.Mesh(
      pageWireframeGeometry,
      wireframeMaterial,
  );

  const actualPage = new THREE.Mesh(
      pageActualGeometry,
      finalMaterials,
  );

  const wireframePoints = new THREE.Points(pageWireframeGeometry,
      pointMaterial);

  wireframePage.translateY(0.05);
  wireframePoints.translateY(0.05);

  wireframePoints.name = pointsAssetName;
  wireframePage.name = wireframeAssetName;
  actualPage.name = actualAssetName;

  // Will be visible in terrain edit mode
  wireframePoints.visible = false;
  wireframePage.visible = false;

  page.add(wireframePoints);
  page.add(wireframePage);
  page.add(actualPage);

  // For faster lookup
  page.userData.lookup = {
    points: wireframePoints,
    wireframe: wireframePage,
    actual: actualPage,
  };

  wireframePoints.matrixAutoUpdate = false;
  wireframePage.matrixAutoUpdate = false;
  actualPage.matrixAutoUpdate = false;

  wireframePoints.updateMatrix();
  wireframePage.updateMatrix();
  actualPage.updateMatrix();

  page.matrixAutoUpdate = false;
  page.name = pageAssetName;

  return page;
}

/**
 * Adjust edges for the page and its surroundings
 * @param {Object3D} pagePlane - 3D plane for the page, as built by
 *                               makePagePlane.
 * @param {ElevationData} elevationData - Elevation data for the target page.
 * @param {Object3D} left - 3D plane for the left page (if any).
 * @param {Object3D} topLeft - 3D plane for the top-left page (if any).
 * @param {Object3D} top - 3D plane for the top page (if any).
 * @param {ElevationData} right - Elevation data for the right page (if any).
 * @param {ElevationData} bottomRight - Elevation data for the bottom-right page
 *                                    (if any).
 * @param {ElevationData} bottom - Elevation data for the bottom page (if any).
 * @param {integer} nbSegments - Number of segments on both X and Z axis.
 */
function adjustPageEdges(pagePlane, elevationData, left, topLeft, top, right,
    bottomRight, bottom, nbSegments) {
  const centerPositions = {
    points: pagePlane.userData.lookup.points.geometry.getAttribute('position'),
    wireframe: pagePlane.userData.lookup.wireframe.geometry
        .getAttribute('position'),
    actual: pagePlane.userData.lookup.actual.geometry.getAttribute('position'),
  };

  const leftPositions = left ? {
    points: left.userData.lookup.points.geometry.getAttribute('position'),
    wireframe: left.userData.lookup.wireframe.geometry.getAttribute('position'),
    actual: left.userData.lookup.actual.geometry.getAttribute('position'),
  } : null;

  const topLeftPositions = topLeft ? {
    points: topLeft.userData.lookup.points.geometry.getAttribute('position'),
    wireframe: topLeft.userData.lookup.wireframe.geometry
        .getAttribute('position'),
    actual: topLeft.userData.lookup.actual.geometry.getAttribute('position'),
  } : null;

  const topPositions = top ? {
    points: top.userData.lookup.points.geometry.getAttribute('position'),
    wireframe: top.userData.lookup.wireframe.geometry.getAttribute('position'),
    actual: top.userData.lookup.actual.geometry.getAttribute('position'),
  } : null;

  const posStride = (nbSegments + 1) * 3;
  const posActualStride = nbSegments * 12;

  const setHeight = ({points, wireframe, actual}, x, z,
      elev, elevX, elevZ) => {
    const id = z * posStride + x * 3 + 1;
    const value = (elev[elevZ * nbSegments + elevX] - zeroElevationValue) /
        100.0;

    points.array[id] = value;
    wireframe.array[id] = value;
    setActualPageVertexHeights(actual.array, posActualStride, nbSegments,
        x, z, value);

    points.needsUpdate = true;
    wireframe.needsUpdate = true;
    actual.needsUpdate = true;
  };

  // Adjust other planes first, starting
  // with the top-left one (-1,-1)
  if (topLeftPositions) {
    setHeight(topLeftPositions, nbSegments, nbSegments,
        elevationData, 0, 0);
  }

  // Then the left (-1, 0) and top (0, -1) ones
  for (let i = 0; i < nbSegments; i++) {
    if (leftPositions) {
      setHeight(leftPositions, nbSegments, i,
          elevationData, 0, i);
    }

    if (topPositions) {
      setHeight(topPositions, i, nbSegments,
          elevationData, i, 0);
    }
  }

  topLeft?.userData.lookup.wireframe.geometry.computeVertexNormals();
  left?.userData.lookup.wireframe.geometry.computeVertexNormals();
  top?.userData.lookup.wireframe.geometry.computeVertexNormals();

  const topLeftWireframeNormals =
      topLeft?.userData.lookup.wireframe.geometry.getAttribute('normal').array;
  const leftWireframeNormals =
      left?.userData.lookup.wireframe.geometry.getAttribute('normal').array;
  const topWireframeNormals =
      top?.userData.lookup.wireframe.geometry.getAttribute('normal').array;

  if (topLeftWireframeNormals) {
    const actualNormals =
        topLeft.userData.lookup.actual.geometry.getAttribute('normal');
    syncActualPageNormals(topLeftWireframeNormals, actualNormals.array,
        nbSegments);
    actualNormals.needsUpdate = true;
  }

  if (leftWireframeNormals) {
    const actualNormals =
        left.userData.lookup.actual.geometry.getAttribute('normal');
    syncActualPageNormals(leftWireframeNormals, actualNormals.array,
        nbSegments);
    actualNormals.needsUpdate = true;
  }

  if (topWireframeNormals) {
    const actualNormals =
        top.userData.lookup.actual.geometry.getAttribute('normal');
    syncActualPageNormals(topWireframeNormals, actualNormals.array,
        nbSegments);
    actualNormals.needsUpdate = true;
  }

  // Second: adjust the target plane itself, staring with
  // the bottom-right data (1, 1)
  if (bottomRight) {
    setHeight(centerPositions, nbSegments, nbSegments,
        bottomRight, 0, 0);
  }

  // Then the right (1, 0) and bottom (0, 1) ones
  for (let i = 0; i < nbSegments; i++) {
    if (right) {
      setHeight(centerPositions, nbSegments, i,
          right, 0, i);
    }

    if (bottom) {
      setHeight(centerPositions, i, nbSegments,
          bottom, i, 0);
    }
  }

  pagePlane.userData.lookup.wireframe.geometry.computeVertexNormals();
  const actualNormals =
      pagePlane.userData.lookup.actual.geometry.getAttribute('normal');
  const wireframeNormals =
      pagePlane.userData.lookup.wireframe.geometry.getAttribute('normal').array;
  syncActualPageNormals(wireframeNormals, actualNormals.array, nbSegments);
  actualNormals.needsUpdate = true;
}

export {generateTerrainMaterials, makePagePlane, adjustPageEdges,
  pageNodeCollisionPreSelector};
