class HttpClient {
    constructor(url = "/api", cors = false, token = null) {
        this.headers = new Headers();
        this.headers.append('Content-Type', 'application/json');
        this.token = token;

        if (token) this.setAuthToken(token);

        this.url = url;
        this.cors = cors;
    }

    setAuthToken(token) {
        this.clear();
        this.headers.append('Authorization', 'Bearer ' + token);
    }

    clear() {
        if (this.headers.has('Authorization')) this.headers.delete('Authorization');
    }

    async login(username, password) {
        const request = new Request(this.url + '/login', {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({username, password}),
            mode: this.cors ? 'cors' : undefined
        });

        return await fetch(request).then(response => {
            if(response.ok) return response.json();
            else throw(response.status);
        })
        .then(json => {
            if(json.token) return json.token;
            else throw('Missing authorization token');
        })
        .then(token => {
            this.setAuthToken(token);
            return token;
        });
    }

    async getWorlds() {
        const request = new Request(`${this.url}/worlds`, {
            method: 'GET',
            headers: this.headers,
            mode: this.cors ? 'cors' : undefined
        });

        return await fetch(request).then(response => {
            if(response.ok) return response.json();
            else throw(response.status);
        });
    }

    async getProps(wid, minX, maxX, minY, maxY, minZ, maxZ) {
        let params = [];

        if (minX) params.push(`minX=${minX}`);
        if (maxX) params.push(`maxX=${maxX}`);
        if (minY) params.push(`minY=${minY}`);
        if (maxY) params.push(`maxY=${maxY}`);
        if (minZ) params.push(`minZ=${minZ}`);
        if (maxZ) params.push(`maxZ=${maxZ}`);

        if (params.length)
            params = '?' + params.join('&');
        else
            params = '';

        const request = new Request(`${this.url}/worlds/${wid}/props${params}`, {
            method: 'GET',
            headers: this.headers,
            mode: this.cors ? 'cors' : undefined
        });

        return await fetch(request).then(response => {
            if(response.ok) return response.json();
            else throw(response.status);
        });
    }
}

export default HttpClient;
