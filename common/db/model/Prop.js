class Prop {
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
