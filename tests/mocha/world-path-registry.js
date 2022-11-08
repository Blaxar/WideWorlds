import WorldPathRegistry from '../../client/src/core/world-path-registry.js';
import ModelRegistry from '../../client/src/core/model-registry.js';
import {LoadingManager} from 'three';
import * as assert from 'assert';

// Testing model registry
describe('WorldPathRegistry and ModelRegistry', () => {
    it('ModelRegistry', async () => {
        const registry = new ModelRegistry(new LoadingManager(),
                                           'http://127.0.0.1/some/path/rwx',
                                           'http://127.0.0.1/some/path/textures');

        assert.equal(registry.loader.path, 'http://127.0.0.1/some/path/rwx');
        assert.equal(registry.materialManager.folder, 'http://127.0.0.1/some/path/textures');
        assert.equal(registry.basicLoader.path, 'http://127.0.0.1/some/path/rwx');
        assert.equal(registry.basicMaterialManager.folder, 'http://127.0.0.1/some/path/textures');

        assert.equal(registry.models.size, 0);

        const model = await registry.get('notfound.rwx');
        assert.equal(model.name, 'unknown');

        const basicModel = await registry.getBasic('notfound.rwx');
        assert.equal(basicModel.name, 'unknown');

        assert.equal(registry.models.size, 1);
        assert.equal(registry.basicModels.size, 1);

        registry.clear();
        assert.equal(registry.models.size, 0);
        assert.equal(registry.basicModels.size, 0);
    });

    it('WorldPathRegistry', async () => {
        const registry = new WorldPathRegistry(new LoadingManager());
        assert.equal(registry.modelPath, 'rwx');
        assert.equal(registry.resourcePath, 'textures');
        assert.equal(registry.modelRegistries.size, 0);

        const modelRegistry = await registry.get('http://127.0.0.1/some/path');
        assert.equal(registry.modelRegistries.size, 1);
        assert.ok(modelRegistry instanceof ModelRegistry);

        assert.equal(registry.modelRegistries.size, 1);

        registry.clear();
        assert.equal(registry.modelRegistries.size, 0);
    });
});
