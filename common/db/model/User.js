class User {
    constructor(id, name, password, email, role, salt) {
        this.id = id;
        this.name = name;
        this.password = password;
        this.email = email;
        this.role = role;
        this.salt = salt;
    }
}

export default User;
