import RWXLoader from 'three-rwx-loader';
import {Group, Mesh, BufferGeometry, BufferAttribute, MeshBasicMaterial} from 'three';

class ModelRegistry {
    constructor(loadingManager, path, resourcePath) {
        const placeholderGeometry = new BufferGeometry();
        const positions = [
            0.0,  0.2,  0.0,
            -0.2,  0.0,  0.0,
            0.2,  0.0,  0.0
        ];

        placeholderGeometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
        placeholderGeometry.setIndex([0, 1, 2]);
        placeholderGeometry.addGroup(0, 3, 0);

        this.placeholder = new Group().add(new Mesh(placeholderGeometry, [new MeshBasicMaterial({color: 0x000000})]));
        this.placeholder.name = 'unknown';

        this.models = new Map();
        this.loader = (new RWXLoader(loadingManager)).setPath(path).setResourcePath(resourcePath);
    }

    /* Fetch an object from the registry, load it first if necessary and use placeholder if not found */
    async get(name) {
        if(!this.models.has(name)) {
            this.models.set(name, new Promise((resolve) => {
                this.loader.load(name, (rwx) => resolve(rwx), null, () => resolve(this.placeholder));
            }));
        }

        return await this.models.get(name);
    }

    clear() {
        this.models.clear();
    }
}

export default ModelRegistry;
