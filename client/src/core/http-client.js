/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {unpackElevationData} from '../../../common/terrain-utils.js';

/**
 * @typedef AuthToken
 * @type {object}
 * @property {string} id - ID of the user account bound to this token.
 * @property {string} token - Authorization token, to be included in
 *                            subsequent HTTP requests.
 */

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
   * @return {Promise<AuthToken>} Valid authorization token.
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
          if (json.token) return {id: json.id, token: json.token};
          else throw new Error('Missing authorization token');
        })
        .then(({id, token}) => {
          this.setAuthToken(token);
          return {id, token};
        });
  }

  /**
   * Get a list of available worlds to connect to
   * @return {Promise<Array<World>>} List of worlds.
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
   * Get a list of props from a given world within a defined area
   * @param {integer} wid - ID of the world to get props from.
   * @param {integer|null} minX - Minimum X coordinate value (in meters).
   * @param {integer|null} maxX - Maximum X coordinate value (in meters).
   * @param {integer|null} minY - Minimum Y coordinate value (in meters).
   * @param {integer|null} maxY - Maximum Y coordinate value (in meters).
   * @param {integer|null} minZ - Minimum Z coordinate value (in meters).
   * @param {integer|null} maxZ - Maximum Z coordinate value (in meters).
   * @return {Promise<Array<Prop>>} List of props.
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

  /**
   * Get the most recent prop date on a given world within a defined area
   * @param {integer} wid - ID of the world to get props from.
   * @param {integer|null} minX - Minimum X coordinate value (in meters).
   * @param {integer|null} maxX - Maximum X coordinate value (in meters).
   * @param {integer|null} minY - Minimum Y coordinate value (in meters).
   * @param {integer|null} maxY - Maximum Y coordinate value (in meters).
   * @param {integer|null} minZ - Minimum Z coordinate value (in meters).
   * @param {integer|null} maxZ - Maximum Z coordinate value (in meters).
   * @return {integer|null} Most recent prop timestamp in milliseconds (if any).
   */
  async getPropsHash(wid, minX, maxX, minY, maxY, minZ, maxZ) {
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

    const request =
        new Request(`${this.url}/worlds/${wid}/props-hash${params}`, {
          method: 'GET',
          headers: this.headers,
          mode: this.cors ? 'cors' : undefined,
        });

    return await fetch(request).then(async (response) => {
      if (response.ok) {
        const {hash} = await response.json();
        return hash;
      } else {
        throw new Error(response.status);
      }
    });
  }

  /**
   * Update certain props on a given world
   * @param {integer} wid - ID of the world to update props on.
   * @param {Object} props - Map of props to be updated, indexed by their ID
   *                         and holding all meaningful properties in an object
   *                         as value.
   * @return {Promise<Object>} Map of results for props to be updated, indexed
   *                           by their ID, value is true in case of success,
   *                           false in case of failure (privilege or
   *                           ownership restriction) and null when the prop
   *                           wasn't found.
   */
  async putProps(wid, props) {
    const request = new Request(`${this.url}/worlds/${wid}/props`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(props),
      mode: this.cors ? 'cors' : undefined,
    });

    return await fetch(request).then((response) => {
      if (response.ok) return response.json();
      else throw new Error(response.status);
    });
  }

  /**
   * Create props on a given world
   * @param {integer} wid - ID of the world to create props on.
   * @param {Array} props - List props to be updated, holding all meaningful
   *                        properties in objects as individual items.
   * @return {Promise<Array<boolean|null>>}
   * List of results for props to be created, item is true in case of success,
   * false in case of failure (privilege or ownership restriction) and null if
   * provided data was invalid or incomplete.
   */
  async postProps(wid, props) {
    const request = new Request(`${this.url}/worlds/${wid}/props`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(props),
      mode: this.cors ? 'cors' : undefined,
    });

    return await fetch(request).then((response) => {
      if (response.ok) return response.json();
      else throw new Error(response.status);
    });
  }

  /**
   * Delete props on a given world
   * @param {integer} wid - ID of the world to deleted props from.
   * @param {Array} props - List of props to be deleted, entries are prop IDs.
   * @return {Array} List of results for props to be deleted, item is true in
   *                 case of success, false in case of failure (because of
   *                 privilege/ownership) and null if prop was not found.
   */
  async deleteProps(wid, props) {
    const request = new Request(`${this.url}/worlds/${wid}/props`, {
      method: 'DELETE',
      headers: this.headers,
      body: JSON.stringify(props),
      mode: this.cors ? 'cors' : undefined,
    });

    return await fetch(request).then((response) => {
      if (response.ok) return response.json();
      else throw new Error(response.status);
    });
  }

  /**
   * Get terrain page
   * @param {integer} wid - ID of the world to get the URLs from.
   * @param {integer} pageX - Index of the page on the X axis.
   * @param {integer} pageZ - Index of the page on the Z axis.
   * @return {Promise<Object>} Object storing elevation and texture data.
   */
  async getTerrainPage(wid, pageX, pageZ) {
    const pageURI = `${this.url}/worlds/${wid}/terrain/${pageX}/${pageZ}/`;
    const data = {
      elevationData: null,
      textureData: null,
    };

    const elevationURL = pageURI + 'elevation';
    const textureURL = pageURI + 'texture';

    const elevationRequest = new Request(elevationURL, {
      method: 'GET',
      headers: this.headers,
      mode: this.cors ? 'cors' : undefined,
    });

    const textureRequest = new Request(textureURL, {
      method: 'GET',
      headers: this.headers,
      mode: this.cors ? 'cors' : undefined,
    });

    data.elevationData = await fetch(elevationRequest).then((response) => {
      if (response.ok) {
        return response.arrayBuffer();
      } else throw new Error(response.status);
    }).then((buffer) => {
      return unpackElevationData(new Uint8Array(buffer));
    });

    data.textureData = await fetch(textureRequest).then((response) => {
      if (response.ok) {
        return response.arrayBuffer();
      } else throw new Error(response.status);
    }).then((buffer) => {
      return new Uint8Array(buffer);
    });

    return data;
  }

  /**
   * Get water page
   * @param {integer} wid - ID of the world to get the URLs from.
   * @param {integer} pageX - Index of the page on the X axis.
   * @param {integer} pageZ - Index of the page on the Z axis.
   * @return {Promise<Uint16Array>} Array storing water elevation data.
   */
  async getWaterPage(wid, pageX, pageZ) {
    const pageURI = `${this.url}/worlds/${wid}/water/${pageX}/${pageZ}/`;

    const elevationRequest = new Request(pageURI, {
      method: 'GET',
      headers: this.headers,
      mode: this.cors ? 'cors' : undefined,
    });

    return await fetch(elevationRequest).then((response) => {
      if (response.ok) {
        return response.arrayBuffer();
      } else throw new Error(response.status);
    }).then((buffer) => {
      return unpackElevationData(new Uint8Array(buffer));
    });
  }
}

export default HttpClient;
