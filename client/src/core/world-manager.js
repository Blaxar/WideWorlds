import HttpClient from './http-client.js';
import Engine3D from './engine-3d.js';
import ModelRegistry from './world-path-registry.js';
import WorldPathRegistry from './world-path-registry.js';

const mToCmRatio = 0.01;
const degToRadRatio = Math.PI / 180.0;

class WorldManager {
    constructor(engine3d, worldPathRegistry, httpClient, chunkSide = 6000) {
        this.engine3d = engine3d;
        this.worldPathRegistry = worldPathRegistry;
        this.httpClient = httpClient;
        this.chunkSide = chunkSide; // Expressed in centimeters
        this.currentWorld = null;
        this.currentModelRegistry = null;
        this.chunks = new Map();
    }

    // Takes in a world json description, parse it and set the 3D scene accordingly
    async load(world) {
        if (this.currentWorld) this.unload();

        this.currentWorld = world;
        const data = JSON.parse(world.data);

        // Fetch all the sky colors from the world data, normalize them between 0.0 and 1.0
        this.engine3d.setSkyColors([
            ...data.skyColor.north,
            ...data.skyColor.east,
            ...data.skyColor.south,
            ...data.skyColor.west,
            ...data.skyColor.top,
            ...data.skyColor.bottom
        ].map((c) => c / 255.0));

        if (!data.path) throw('Missing path field from world data json');

        this.currentModelRegistry = await this.worldPathRegistry.get(data.path);

        if (data.skybox) {
            const model = await this.currentModelRegistry.getBasic(`${data.skybox}.rwx`);
            this.engine3d.setSkyBox(model);
        }

        this.loadChunk(0, 0);
    }

    // Clear current world data, reset engine3d state and chunks
    async unload() {
        this.currentWorld = null;
        this.currentModelRegistry = null;
        this.engine3d.resetSkyColors();
        this.engine3d.resetSkyBox();
        await this.clearChunks();
    }

    async clearChunks() {
        for (const [key, handle] of this.chunks) {
            this.engine3d.removeNode(handle);
        }

        this.chunks.clear();
    }

    async loadChunk(x, z) {
        const halfChunkSide = this.chunkSide / 2;
        const chunk = await this.httpClient.getProps(this.currentWorld.id,
                                                     x * this.chunkSide - halfChunkSide,
                                                     (x + 1) * this.chunkSide - halfChunkSide,
                                                     null, null, // We set no limit on the vertical (y) axis
                                                     z * this.chunkSide - halfChunkSide,
                                                     (z + 1) * this.chunkSide - halfChunkSide);
        const chunkNodeHandle = this.engine3d.spawnNode();

        for (const prop of chunk) {
            const obj3d = await this.currentModelRegistry.get(prop.name);
            obj3d.position.set(prop.x * mToCmRatio, prop.y * mToCmRatio, prop.z * mToCmRatio);

            obj3d.rotation.set(prop.pitch * degToRadRatio / 10,
                               prop.yaw * degToRadRatio / 10,
                               prop.roll * degToRadRatio / 10,
                               'YZX');

            // TODO: return/break if node is no longer there (loading cancelled?)
            this.engine3d.appendToNode(chunkNodeHandle, obj3d);
        }

        this.chunks.set(`${x}_${z}`, chunkNodeHandle);
    }
}

export default WorldManager;
