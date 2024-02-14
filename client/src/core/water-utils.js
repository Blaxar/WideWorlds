/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {zeroElevationValue, pageAssetName} from
  '../../../common/terrain-utils.js';
import * as THREE from 'three';

// Filter to use when computing bounds tree on the water page:
// only the actual page geometry should be used, not the wireframe
// and points cloud overlays
const pageNodeCollisionPreSelector = (obj3d) =>
  obj3d.getObjectByName(pageAssetName);

const defaultOffset = new THREE.Vector3();

// Tweaking the existing MeshPhongMaterial vertex shader for our
// own needs
const vertexShader = /* glsl */`
#define PHONG

uniform float time;
uniform float speed;
uniform float amplitude;
uniform float wavelength;
uniform float normalScalar;
varying vec3 vViewPosition;

#include <common>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

  #include <uv_vertex>
  #include <color_vertex>
  #include <morphcolor_vertex>

  #include <beginnormal_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <normal_vertex>

  #include <begin_vertex>

  float x = transformed.x * PI2 / wavelength;
  float z = transformed.z * PI2 / wavelength;
  float t = time * speed;
  transformed = transformed +
    vec3(0.0, amplitude * sin(t + sqrt(x * x + z * z)), 0.0);
  float dfdx =
    amplitude * cos(t + sqrt(x * x + z * z)) * (x / sqrt(x * x + z * z));
  float dfdz =
    amplitude * cos(t + sqrt(x * x + z * z)) * (z / sqrt(x * x + z * z));

  vec3 tx = vec3(1.0, dfdx, 0.0);
  vec3 tz = vec3(0.0, dfdz, 1.0);
  vec3 nc = normalize(cross(tz, tx));
  vec3 up = vec3(0.0, 1.0, 0.0);
  if (x == 0.0 && z == 0.0) {
    vNormal = normalMatrix * (up * normalScalar);
  } else {
    vNormal = normalMatrix * (nc * normalScalar);
  }

  #include <morphtarget_vertex>
  #include <skinning_vertex>
  #include <displacementmap_vertex>
  #include <project_vertex>
  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>

  vViewPosition = - mvPosition.xyz;

  #include <worldpos_vertex>
  #include <envmap_vertex>
  #include <shadowmap_vertex>
  #include <fog_vertex>

}
`;

/**
 * Reusing most of the phong material for our custom shader material
 * for water rendering.
 */
class WaterPhongMaterial extends THREE.ShaderMaterial {
  /**
   * @constructor
   * @param {Object} parameters - three.js Material parameters.
   */
  constructor(parameters) {
    const baseMatKey = 'phong';
    const uniforms = THREE.UniformsUtils.clone(
        THREE.ShaderLib[baseMatKey].uniforms,
    );

    uniforms.time = {value: 0.0};
    uniforms.speed = {value: 1.0};
    uniforms.amplitude = {value: 1.0};
    uniforms.wavelength = {value: 30.0};
    uniforms.normalScalar = {value: 1.0}; // -1.0 to face downwards

    // From refreshUniformsCommon( uniforms, material )
    uniforms.emissive.value = new THREE.Color(0x111111);
    uniforms.diffuse.value = new THREE.Color(0xffffff);
    uniforms.opacity.value = 1.0;

    // From refreshUniformsPhong( uniforms, material )
    uniforms.specular.value = new THREE.Color(0x111111);
    uniforms.shininess.value = 30; // to prevent pow( 0.0, 0.0 )

    // From refreshTransformUniform( map, uniform )
    if (parameters.map && parameters.map.isTexture) {
      uniforms.map.value = parameters.map;
      uniforms.map.value.updateMatrix();
      uniforms.mapTransform.value.copy(uniforms.map.value.matrix);
    }

    if (parameters.opacity !== undefined) {
      uniforms.opacity.value = parameters.opacity;
    }

    if (parameters.color !== undefined) {
      uniforms.diffuse.value = parameters.color;
    }

    if (parameters.normalScalar !== undefined) {
      uniforms.normalScalar.value = parameters.normalScalar;
    }

    if (parameters.speed !== undefined) {
      uniforms.speed.value = parameters.speed;
    }

    if (parameters.amplitude !== undefined) {
      uniforms.amplitude.value = parameters.speed;
    }

    if (parameters.waveLength !== undefined) {
      uniforms.waveLength.value = parameters.waveLength;
    }

    const hiddenParameters = {
      uniforms,
      vertexShader,
      fragmentShader: THREE.ShaderLib[baseMatKey].fragmentShader,
      lights: true,
      side: THREE.FrontSide,
    };

    super(hiddenParameters);

    this.normalScalar = null;
    this.speed = null;
    this.amplitude = null;
    this.waveLength = null;

    this.color = new THREE.Color(0xffffff); // diffuse
    this.specular = new THREE.Color(0x111111);
    this.shininess = 30;

    this.map = null;

    this.lightMap = null;
    this.lightMapIntensity = 1.0;

    this.aoMap = null;
    this.aoMapIntensity = 1.0;

    this.emissive = new THREE.Color(0x000000);
    this.emissiveIntensity = 1.0;
    this.emissiveMap = null;

    this.bumpMap = null;
    this.bumpScale = 1;

    this.normalMap = null;
    this.normalMapType = THREE.TangentSpaceNormalMap;
    this.normalScale = new THREE.Vector2(1, 1);

    this.displacementMap = null;
    this.displacementScale = 1;
    this.displacementBias = 0;

    this.specularMap = null;

    this.alphaMap = null;

    this.envMap = null;
    this.combine = THREE.MultiplyOperation;
    this.reflectivity = 1;
    this.refractionRatio = 0.98;

    this.wireframe = false;
    this.wireframeLinewidth = 1;
    this.wireframeLinecap = 'round';
    this.wireframeLinejoin = 'round';

    this.flatShading = false;

    this.fog = true;

    this.setValues( parameters );
  }

  /**
   * Copy parameters from other material instance
   * @param {WaterPhongMaterial} source - Material instance to copy from.
   * @return {this} This instance.
   */
  copy(source) {
    super.copy(source);

    this.color.copy(source.color);
    this.specular.copy(source.specular);
    this.shininess = source.shininess;

    this.map = source.map;

    this.lightMap = source.lightMap;
    this.lightMapIntensity = source.lightMapIntensity;

    this.aoMap = source.aoMap;
    this.aoMapIntensity = source.aoMapIntensity;

    this.emissive.copy(source.emissive);
    this.emissiveMap = source.emissiveMap;
    this.emissiveIntensity = source.emissiveIntensity;

    this.bumpMap = source.bumpMap;
    this.bumpScale = source.bumpScale;

    this.normalMap = source.normalMap;
    this.normalMapType = source.normalMapType;
    this.normalScale.copy(source.normalScale);

    this.displacementMap = source.displacementMap;
    this.displacementScale = source.displacementScale;
    this.displacementBias = source.displacementBias;

    this.specularMap = source.specularMap;

    this.alphaMap = source.alphaMap;

    this.envMap = source.envMap;
    this.combine = source.combine;
    this.reflectivity = source.reflectivity;
    this.refractionRatio = source.refractionRatio;

    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    this.wireframeLinecap = source.wireframeLinecap;
    this.wireframeLinejoin = source.wireframeLinejoin;

    this.flatShading = source.flatShading;

    this.fog = source.fog;

    return this;
  }

  /**
   * Move the water animation forward in time
   * @param {number} delta - Elapsed number of seconds since last update.
   */
  step(delta) {
    this.uniforms.time.value += delta;
    this.needsUpdate = true;
  }
}

/**
 * Make 3D asset for a single water page from provided elevation data
 * @param {Uint16array|null} elevationData - Raw elevation data for the
 *                                           whole page.
 * @param {integer} sideSize - Length of the page side in real space.
 * @param {integer} nbSegments - Number of segments on both X and Z axis.
 * @param {Material} waterMaterial - Surface water material to use.
 * @param {Material} bottomMaterial - Bottom water material to use.
 * @param {Vector3} offset - Position offset to apply on each vertex.
 * @return {Object3D} 3D asset for the water page
 */
function makePagePlane(elevationData, sideSize, nbSegments,
    waterMaterial, bottomMaterial, offset = defaultOffset) {
  const pageGeometry = new THREE.BufferGeometry();
  const nbBufferEntries = (nbSegments + 1) * (nbSegments + 1);
  const positions = new Float32Array(nbBufferEntries * 3);
  const uvs = new Float32Array(nbBufferEntries * 2);
  const faces = [];
  const groupDataPerPoint = 2 * 3;
  const groupLength = nbSegments * nbSegments * groupDataPerPoint;

  // If elevation data is not available: just provide flat, default height.
  const getElevationData = elevationData ?
        (dataId) => elevationData[dataId] :
        () => zeroElevationValue;

  const posStride = (nbSegments + 1) * 3;
  const uvStride = (nbSegments + 1) * 2;

  // Ready top grid geometry
  for (let x = 0; x < nbSegments + 1; x++) {
    const posX = (x - (nbSegments / 2)) * (sideSize / nbSegments) + offset.x;

    for (let z = 0; z < nbSegments + 1; z++) {
      const posZ = (z - (nbSegments / 2)) * (sideSize / nbSegments) + offset.z;
      const dataId = z * nbSegments + x;

      const height = (getElevationData(dataId) - zeroElevationValue) / 100.0;

      positions[z * posStride + x * 3] = posX;
      positions[z * posStride + x * 3 + 2] = posZ;

      uvs[z * uvStride + x * 2] = x;
      uvs[z * uvStride + x * 2 + 1] = nbSegments - z;

      // Out of bounds for elevation data, move on...
      if (x >= nbSegments || z >= nbSegments) continue;

      positions[z * posStride + x * 3 + 1] = height + offset.y;

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
    }
  }

  // Make the bottom faces as well
  for (let x = 0; x < nbSegments; x++) {
    for (let z = 0; z < nbSegments; z++) {
      if ((x + (z % 2) ) % 2) {
        faces.push(
            z * (nbSegments + 1) + x,
            z * (nbSegments + 1) + x + 1,
            (z + 1) * (nbSegments + 1) + x,
            z * (nbSegments + 1) + x + 1,
            (z + 1) * (nbSegments + 1) + x + 1,
            (z + 1) * (nbSegments + 1) + x,
        );
      } else {
        faces.push(
            z * (nbSegments + 1) + x,
            (z + 1) * (nbSegments + 1) + x + 1,
            (z + 1) * (nbSegments + 1) + x,
            z * (nbSegments + 1) + x,
            z * (nbSegments + 1) + x + 1,
            (z + 1) * (nbSegments + 1) + x + 1,
        );
      }
    }
  }

  pageGeometry.addGroup(0, groupLength, 0);
  pageGeometry.addGroup(groupLength, groupLength, 1);

  pageGeometry.setAttribute('position',
      new THREE.BufferAttribute(positions, 3));
  pageGeometry.setAttribute('uv',
      new THREE.BufferAttribute(uvs, 2));
  pageGeometry.setIndex(faces);
  pageGeometry.computeVertexNormals();

  const page = new THREE.Mesh(
      pageGeometry,
      [waterMaterial, bottomMaterial],
  );

  page.name = pageAssetName;

  return page;
}

/**
 * Load water materials
 * @param {TextureLoader} textureLoader - three.js texture loader instance.
 * @param {string} url - Base texture URL.
 * @param {Object} water - Dictionary holding water properties.
 * @return {Object} Object holding waterMaterial and bottomMaterial.
 */
function loadWaterMaterials(textureLoader, url, water) {
  let waterMaterial = null;
  let bottomMaterial = null;

  const opacity = water.opacity !== undefined ? water.opacity : 1.0;
  const transparent = opacity < 1.0 ? true : false;
  const amplitude = water.waveMove !== undefined ? water.waveMove: 0.0;
  const speed = water.speed !== undefined ? water.speed: 1.0;

  if (water.texture) {
    const texture = textureLoader.load(`${url}/${water.texture}.jpg`);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    waterMaterial = new WaterPhongMaterial({
      map: texture,
      opacity,
      transparent,
      amplitude,
      speed,
    });

    // If there is no texture for the bottom, reuse the one from the
    // surface.
    if (!water.bottomTexture) {
      bottomMaterial = new WaterPhongMaterial({
        map: texture,
        opacity,
        transparent,
        amplitude,
        speed,
        normalScalar: -1.0,
      });
    }
  } else if (!water.bottomTexture) {
    waterMaterial = new WaterPhongMaterial({
      color: new THREE.Color(`#${water.color}`),
      opacity,
      transparent,
      amplitude,
      speed,
    });
  }

  if (water.bottomTexture) {
    const texture = textureLoader.load(`${url}/${water.bottomTexture}.jpg`);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    bottomMaterial = new WaterPhongMaterial({
      map: texture,
      opacity,
      transparent,
      amplitude,
      speed,
      normalScalar: -1.0,
    });

    // If there is no texture for the surface, reuse the one from the
    // bottom.
    if (!water.texture) {
      waterMaterial = new WaterPhongMaterial({
        map: texture,
        opacity,
        transparent,
        amplitude,
        speed,
      });
    }
  } else if (!water.waterTexture) {
    bottomMaterial = new WaterPhongMaterial({
      color: new THREE.Color(`#${water.color}`),
      opacity,
      transparent,
      amplitude,
      speed,
      normalScalar: -1.0,
    });
  }

  return {waterMaterial, bottomMaterial};
}

export {WaterPhongMaterial, makePagePlane, loadWaterMaterials,
  pageNodeCollisionPreSelector};
