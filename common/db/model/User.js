class User {
    constructor(id, name, password, email, role, salt, privilegePassword = null) {
        this.id = id;
        this.name = name;
        this.password = password;
        this.email = email;
        this.role = role;
        this.salt = salt;
        this.privilegePassword = privilegePassword;
    }
}

export default User;
