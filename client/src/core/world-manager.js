import {Vector3} from 'three';
import HttpClient from './http-client.js';
import Engine3D from './engine-3d.js';
import ModelRegistry from './world-path-registry.js';
import WorldPathRegistry from './world-path-registry.js';

const cmToMRatio = 0.01;
const degToRadRatio = Math.PI / 180.0;

const chunkLoadingPattern = [[-1, 1], [0, 1], [1, 1],
                             [-1, 0], [0, 0], [1, 0],
                             [-1, -1], [0, -1], [1, -1]];

class WorldManager {
    constructor(engine3d, worldPathRegistry, httpClient, chunkSide = 2000) {
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

        this.update(new Vector3(0, 0, 0));
    }

    // Clear current world data, reset engine3d state and chunks
    unload() {
        this.currentWorld = null;
        this.currentModelRegistry = null;
        this.engine3d.resetSkyColors();
        this.engine3d.resetSkyBox();
        this.clearChunks();
    }

    clearChunks() {
        for (const handle of this.chunks.values()) {
            this.engine3d.removeNode(handle);
        }

        this.chunks.clear();
    }

    // Load necessary chunks and various elements based on the provided camera position
    update(pos) {
        if (!(this.currentWorld && this.currentModelRegistry)) return;

        const cX = Math.floor(pos.x / (this.chunkSide * cmToMRatio) + 0.5);
        const cZ = Math.floor(pos.z / (this.chunkSide * cmToMRatio) + 0.5);

        for(const [x, z] of chunkLoadingPattern) {
            this.loadChunk(cX + x, cZ + z);
        }
    }

    async loadChunk(x, z) {
        const chunkId = `${x}_${z}`;
        if (this.chunks.has(chunkId)) return;

        await this.reloadChunk(x, z);
    }

    async reloadChunk(x, z) {
        const chunkId = `${x}_${z}`;

        if (this.chunks.has(chunkId)) {
            // The chunk is already there: this is a reload scenario
            this.engine3d.removeNode(this.chunks.get(chunkId));
            this.chunks.remove(chunkId);
        }

        const chunkPos = [x * this.chunkSide * cmToMRatio, 0, z * this.chunkSide * cmToMRatio];
        const chunkNodeHandle = this.engine3d.spawnNode(...chunkPos);
        this.chunks.set(`${x}_${z}`, chunkNodeHandle);

        const halfChunkSide = this.chunkSide / 2;
        const chunk = await this.httpClient.getProps(this.currentWorld.id,
                                                     x * this.chunkSide - halfChunkSide,
                                                     (x + 1) * this.chunkSide - halfChunkSide,
                                                     null, null, // We set no limit on the vertical (y) axis
                                                     z * this.chunkSide - halfChunkSide,
                                                     (z + 1) * this.chunkSide - halfChunkSide);

        const modelRegistry = this.currentModelRegistry;

        for (const prop of chunk) {
            const obj3d = await modelRegistry.get(prop.name);
            obj3d.position.set(prop.x * cmToMRatio - chunkPos[0],
                               prop.y * cmToMRatio,
                               prop.z * cmToMRatio - chunkPos[2]);

            obj3d.rotation.set(prop.pitch * degToRadRatio / 10,
                               prop.yaw * degToRadRatio / 10,
                               prop.roll * degToRadRatio / 10,
                               'YZX');

            if (!this.engine3d.appendToNode(chunkNodeHandle, obj3d)) {
                // Could not append object to node, meaning node (chunk) no longer exists,
                // we just silently cancel the whole loading.
                return;
            }
        }
    }
}

export default WorldManager;
