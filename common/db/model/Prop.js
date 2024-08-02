/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

/** World Prop entity */
class Prop {
  /**
   * @constructor
   * @param {integer} id - ID of the prop.
   * @param {integer} wid - ID of the world the prop belongs to.
   * @param {integer} uid - ID of the user the prop belongs to.
   * @param {timestamp} date - Creation/modification date of the prop.
   * @param {number} x - X coordinate of the prop (in meters).
   * @param {number} y - Y coordinate of the prop (in meters).
   * @param {number} z - Z coordinate of the prop (in meters).
   * @param {number} ya - Yaw of the prop (in radians).
   * @param {number} pi - Pitch of the prop (in radians).
   * @param {number} ro - Roll of the prop (in radians).
   * @param {string} name - Model name of the prop.
   * @param {string} desc - Description of the prop.
   * @param {string} act - Action field of the prop.
   */
  constructor(id, wid, uid, date, x, y, z, ya, pi, ro, name, desc, act) {
    this.id = id;
    this.worldId = wid;
    this.userId = uid;
    this.date = date;
    this.x = x;
    this.y = y;
    this.z = z;
    this.yaw = ya;
    this.pitch = pi;
    this.roll = ro;
    this.name = name;
    this.description = desc;
    this.action = act;
  }
}

export default Prop;
