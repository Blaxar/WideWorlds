const EntitySchema = require('typeorm').EntitySchema;
const User = require('../model/User').User;

module.exports = new EntitySchema({
    name: 'User',
    target: User,
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true
        },
        name: {
            type: 'text'
        },
        password: {
            type: 'text'
        },
        email: {
            type: 'text'
        },
        salt: {
            type: 'text'
        }
    }
});
