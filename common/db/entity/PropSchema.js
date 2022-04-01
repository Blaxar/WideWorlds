const EntitySchema = require('typeorm').EntitySchema;
const Prop = require('../model/Prop').Prop;
const User = require('../model/User').User;
const World = require('../model/World').World;

module.exports = new EntitySchema({
    name: 'Prop',
    target: Prop,
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true
        },
        worldId: {
            type: 'int'
        },
        userId: {
            type: 'int'
        },
        date: {
            type: 'int'
        },
        x: {
            type: 'int'
        },
        y: {
            type: 'int'
        },
        z: {
            type: 'int'
        },
        yaw: {
            type: 'int'
        },
        pitch: {
            type: 'int'
        },
        roll: {
            type: 'int'
        },
        name: {
            type: 'text'
        },
        description: {
            type: 'text'
        },
        action: {
            type: 'text'
        }
    }
});
