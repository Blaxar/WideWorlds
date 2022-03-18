/* export */ class User {
    constructor(id, name, password, email) {
        this.id = id;
        this.name = name;
        this.password = password;
        this.email = email;
    }
}

module.exports = {
    User
};
