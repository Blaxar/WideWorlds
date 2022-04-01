/* export */ class User {
    constructor(id, name, password, email, salt) {
        this.id = id;
        this.name = name;
        this.password = password;
        this.email = email;
        this.salt = salt;
    }
}

module.exports = {
    User
};
