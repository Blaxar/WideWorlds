/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

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
      type: 'double precision', // meters
    },
    y: {
      type: 'double precision', // meters
    },
    z: {
      type: 'double precision', // meters
    },
    yaw: {
      type: 'float', // radians
    },
    pitch: {
      type: 'float', // radians
    },
    roll: {
      type: 'float', // radians
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
