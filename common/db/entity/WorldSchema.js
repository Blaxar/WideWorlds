import {EntitySchema} from 'typeorm';
import World from '../model/World.js';

const WorldSchema = new EntitySchema({
    name: 'World',
    target: World,
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true
        },
        name: {
            type: 'text'
        },
        data: {
            type: 'text'
        }
    }
});

export default WorldSchema;
