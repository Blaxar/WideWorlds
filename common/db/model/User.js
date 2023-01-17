/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

/** User entity */
class User {
  /**
   * @constructor
   * @param {integer} id - ID of the user.
   * @param {string} name - Name of the user.
   * @param {string} password - Hashed and salted password of the user.
   * @param {string} email - Email address of the user.
   * @param {string} role - Role of the user.
   * @param {string} salt - Salt value of the user, for cryptographic purposes.
   * @param {string} privilegePassword - Hashed and salted privilege password
   *                                     of the user.
   */
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
