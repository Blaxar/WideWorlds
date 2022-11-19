import RWXLoader, {RWXMaterialManager} from 'three-rwx-loader';
import {Group, Mesh, BufferGeometry, BufferAttribute, MeshBasicMaterial} from 'three';
import * as THREE from 'three';
import * as JSZip from 'jszip';
import JSZipUtils from 'jszip-utils';

/* Assume .rwx file extension if none is provided */
const normalizePropName = name => name.match(/.+\.([a-zA-Z0-9]+)$/) ? name : name + '.rwx';

class ModelRegistry {
    constructor(loadingManager, path, resourcePath) {
        this.textureEncoding = THREE.sRGBEncoding;

        this.materialManager = new RWXMaterialManager(resourcePath, '.jpg', '.zip', JSZip, JSZipUtils,
                                                      false, this.textureEncoding);
        this.basicMaterialManager = new RWXMaterialManager(resourcePath, '.jpg', '.zip', JSZip, JSZipUtils,
                                                           true, this.textureEncoding);

        const placeholderGeometry = new BufferGeometry();
        const positions = [
            0.0, 0.2, 0.0,
            -0.2, 0.0, 0.0,
            0.2, 0.0, 0.0
        ];

        placeholderGeometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
        placeholderGeometry.setIndex([0, 1, 2]);
        placeholderGeometry.addGroup(0, 3, 0);

        this.placeholder = new Mesh(placeholderGeometry, [new MeshBasicMaterial({color: 0x000000})]);
        this.placeholder.name = 'unknown';

        this.models = new Map();
        this.basicModels = new Map();

        this.loader = (new RWXLoader(loadingManager)).setRWXMaterialManager(this.materialManager)
            .setPath(path).setFlatten(true);
        this.basicLoader = (new RWXLoader(loadingManager)).setRWXMaterialManager(this.basicMaterialManager)
            .setPath(path).setFlatten(true);
    }

    /* Fetch an object from the registry, load it first if necessary and use placeholder if not found */
    async get(rawName) {
        const name = normalizePropName(rawName);
        if(!this.models.has(name)) {
            this.models.set(name, new Promise((resolve) => {
                this.loader.load(name, (rwx) => { rwx.name = name; resolve(rwx);}, null, () => resolve(this.placeholder.clone()));
            }));
        }

        return (await this.models.get(name)).clone();
    }

    /* Same as above, but using basic materials instead of light-sensitive ones */
    async getBasic(rawName) {
        const name = normalizePropName(rawName);
        if(!this.basicModels.has(name)) {
            this.basicModels.set(name, new Promise((resolve) => {
                this.basicLoader.load(name, (rwx) => { rwx.name = name; resolve(rwx);}, null, () => resolve(this.placeholder.clone()));
            }));
        }

        return (await this.basicModels.get(name)).clone();
    }

    /* Update all animated texture to their next frame */
    texturesNextFrame() {
        this.materialManager.texturesNextFrame();
        this.basicMaterialManager.texturesNextFrame();
    }

    clear() {
        this.models.clear();
        this.basicModels.clear();
    }
}

export default ModelRegistry;
export {normalizePropName};
