import {EntitySchema} from 'typeorm';
import Prop from '../model/Prop.js';

const PropSchema = new EntitySchema({
  name: 'Prop',
  target: Prop,
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    worldId: {
      type: 'int',
    },
    userId: {
      type: 'int',
    },
    date: {
      type: 'int',
    },
    x: {
      type: 'int',
    },
    y: {
      type: 'int',
    },
    z: {
      type: 'int',
    },
    yaw: {
      type: 'int',
    },
    pitch: {
      type: 'int',
    },
    roll: {
      type: 'int',
    },
    name: {
      type: 'text',
    },
    description: {
      type: 'text',
    },
    action: {
      type: 'text',
    },
  },
});

export default PropSchema;
