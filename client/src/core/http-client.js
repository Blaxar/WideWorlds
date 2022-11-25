/** HTTP client utility to interact with the server API */
class HttpClient {
  /**
   * @constructor
   * @param {string} url - Base URL to prepend to API calls.
   * @param {boolean} cors - Enable CORS policy is true.
   * @param {string} token - User authetication token.
   */
  constructor(url = '/api', cors = false, token = null) {
    this.headers = new Headers();
    this.headers.append('Content-Type', 'application/json');
    this.token = token;

    if (token) this.setAuthToken(token);

    this.url = url;
    this.cors = cors;
  }

  /**
   * Set the authentication token value to be used in HTTP request headers
   * @param {string} token - User authetication token.
   */
  setAuthToken(token) {
    this.clear();
    this.headers.append('Authorization', 'Bearer ' + token);
  }

  /** Clear current authentication token */
  clear() {
    if (this.headers.has('Authorization')) this.headers.delete('Authorization');
  }

  /**
   * Sign user into the server, get valid authentication token in case
   * of success
   * @param {string} username - Name of the user.
   * @param {string} password - Password of the user.
   * @return {Promise} Promise of a valid authorization token.
   */
  async login(username, password) {
    const request = new Request(this.url + '/login', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({username, password}),
      mode: this.cors ? 'cors' : undefined,
    });

    return await fetch(request).then((response) => {
      if (response.ok) return response.json();
      else throw new Error(response.status);
    })
        .then((json) => {
          if (json.token) return json.token;
          else throw new Error('Missing authorization token');
        })
        .then((token) => {
          this.setAuthToken(token);
          return token;
        });
  }

  /**
   * Get a list of available worlds to connect to
   * @return {Promise} Promise of a list of worlds.
   */
  async getWorlds() {
    const request = new Request(`${this.url}/worlds`, {
      method: 'GET',
      headers: this.headers,
      mode: this.cors ? 'cors' : undefined,
    });

    return await fetch(request).then((response) => {
      if (response.ok) return response.json();
      else throw new Error(response.status);
    });
  }

  /**
   * Get a list of props from a given worlds within a defined area
   * @param {integer} wid - ID of the world to get props from.
   * @param {integer} minX - Minimum X coordinate value (in centimeters).
   * @param {integer} maxX - Maximum X coordinate value (in centimeters).
   * @param {integer} minY - Minimum Y coordinate value (in centimeters).
   * @param {integer} maxY - Maximum Y coordinate value (in centimeters).
   * @param {integer} minZ - Minimum Z coordinate value (in centimeters).
   * @param {integer} maxZ - Maximum Z coordinate value (in centimeters).
   * @return {Promise} Promise of a list of props.
   */
  async getProps(wid, minX, maxX, minY, maxY, minZ, maxZ) {
    let params = [];

    if (minX) params.push(`minX=${minX}`);
    if (maxX) params.push(`maxX=${maxX}`);
    if (minY) params.push(`minY=${minY}`);
    if (maxY) params.push(`maxY=${maxY}`);
    if (minZ) params.push(`minZ=${minZ}`);
    if (maxZ) params.push(`maxZ=${maxZ}`);

    if (params.length) {
      params = '?' + params.join('&');
    } else {
      params = '';
    }

    const request = new Request(`${this.url}/worlds/${wid}/props${params}`, {
      method: 'GET',
      headers: this.headers,
      mode: this.cors ? 'cors' : undefined,
    });

    return await fetch(request).then((response) => {
      if (response.ok) return response.json();
      else throw new Error(response.status);
    });
  }
}

export default HttpClient;
