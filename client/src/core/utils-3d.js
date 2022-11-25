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

export {makeReversedOctahedron, defaultSkyColors};
