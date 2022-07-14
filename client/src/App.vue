<script setup>
import {computed, reactive} from "vue";
import * as THREE from 'three';
import Splash from './components/Splash.vue';
import Login from './components/Login.vue';
import WorldSelection from './components/WorldSelection.vue';
import AppState, {AppStates} from './core/app-state.js';

const main = reactive({
    state: AppStates.SIGNED_OUT,
    worlds: [],
    token: null
});

const entranceHook = (state) => {
    console.log('Entering "' + state + '" state.');
    main.state = state;
};

const exitHook = (state) => {
    console.log('Leaving "' + state + '" state.');
};

const fetchWorldList = () => {

    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Authorization', 'Bearer ' + main.token);

    const request = new Request(import.meta.env.VITE_SERVER_URL + '/api/worlds', {
        method: 'GET',
        headers: headers,
        mode: 'cors'
    });

    fetch(request).then(response => {
        if(response.ok) return response.json();
        else throw(response.status);
    }).then(json => {
        main.worlds.push(...json);
    });

};

const hooks = {
    [AppStates.SIGNED_OUT]: [entranceHook, exitHook],
    [AppStates.SIGNING_IN]: [entranceHook, exitHook],
    [AppStates.WORLD_UNLOADED]: [(state) => { entranceHook(state); fetchWorldList();}, exitHook],
    [AppStates.WORLD_LOADING]: [entranceHook, exitHook],
    [AppStates.WORLD_LOADED]: [entranceHook, exitHook]
};

const appState = new AppState(hooks);

const handleLogin = ({username, password}) => {

    appState.signIn();

    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const request = new Request(import.meta.env.VITE_SERVER_URL + '/api/login', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({name: username, password: password}),
        mode: 'cors'
    });

    fetch(request).then(response => {
        if(response.ok) return response.json();
        else throw(response.status);
    })
    .then(json => {
        main.token = json.token;
        appState.toWorldSelection();
    })
    .catch(error => {
        appState.failedSigningIn();
    });

};

const displayLogin = computed(() => main.state === AppStates.SIGNED_OUT);
const displayWorldSelection = computed(() => main.state === AppStates.WORLD_UNLOADED && main.worlds.length > 0);

</script>

<template>
    <Splash msg="Wide Worlds" />
    <Login v-if="displayLogin" @submit="handleLogin" />
    <WorldSelection v-if="displayWorldSelection" :worlds="main.worlds"/>
</template>

<style>
@import './assets/base.css';

#app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;

  font-weight: normal;
}

header {
  line-height: 1.5;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

a,
.green {
  text-decoration: none;
  color: hsla(160, 100%, 37%, 1);
  transition: 0.4s;
}

@media (hover: hover) {
  a:hover {
    background-color: hsla(160, 100%, 37%, 0.2);
  }
}

@media (min-width: 1024px) {
  body {
    display: flex;
    place-items: center;
  }

  #app {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 0 2rem;
  }

  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  .logo {
    margin: 0 2rem 0 0;
  }
}
</style>
