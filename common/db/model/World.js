/** World entity */
class World {
  /**
   * @constructor
   * @param {integer} id - ID of the world.
   * @param {string} name - Name of the world.
   * @param {string} data - JSON object holding various world properties.
   */
  constructor(id, name, data) {
    this.id = id;
    this.name = name;
    this.data = data;
  }
}

export default World;
