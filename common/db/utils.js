const typeorm = require('typeorm');
const scryptSync = require('crypto').scryptSync;

const keyLength = 256;
const saltLength = 128;

const init = async (path) => {
    return await typeorm.createConnection({
        type: 'sqlite',
        database: path, 
        entities: [require('./entity/UserSchema'),
                   require('./entity/WorldSchema'),
                   require('./entity/PropSchema')],
        synchronize: true
    });
};

const hashPassword = (password, salt) => {
    return scryptSync(password, salt, keyLength).toString('base64');
}

module.exports = {
    init,
    hashPassword,
    saltLength,
}
