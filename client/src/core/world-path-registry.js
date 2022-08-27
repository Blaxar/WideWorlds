import ModelRegistry from './model-registry.js';

class WorldPathRegistry {
    constructor(loadingManager, modelPath = 'rwx', resourcePath = 'textures') {
        this.modelRegistries = new Map();
        this.loadingManager = loadingManager;
        this.modelPath = modelPath;
        this.resourcePath = resourcePath;
    }

    /* Get model registry for this world path, create it beforehand if needed */
    async get(path) {
        if(!this.modelRegistries.has(path)) {
            this.modelRegistries.set(path, new ModelRegistry(this.loadingManager, `${path}/${this.modelPath}`, `${path}/${this.resourcePath}`));
        }

        return await this.modelRegistries.get(path);
    }

    clear() {
        this.modelRegistries.clear();
    }
}

export default WorldPathRegistry;
