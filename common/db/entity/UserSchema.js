import {EntitySchema} from 'typeorm';
import User from '../model/User.js';

const UserSchema = new EntitySchema({
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
        role: {
            type: 'text'
        },
        salt: {
            type: 'text'
        }
    }
});

export default UserSchema;
