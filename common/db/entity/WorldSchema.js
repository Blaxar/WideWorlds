const EntitySchema = require("typeorm").EntitySchema;
const World = require("../model/World").World;

module.exports = new EntitySchema({
    name: "World",
    target: World,
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        name: {
            type: "text"
        },
        data: {
            type: "text"
        }
    }
});
