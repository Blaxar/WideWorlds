const typeorm = require("typeorm");

const init = async (path) => {
    return await typeorm.createConnection({
        type: "sqlite",
        database: path, 
        entities: [require("./entity/UserSchema"),
                   require("./entity/WorldSchema"),
                   require("./entity/PropSchema")],
        synchronize: true
    });
};

module.exports = {
    init
}
