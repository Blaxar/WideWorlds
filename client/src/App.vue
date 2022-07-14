<script setup>
import * as THREE from 'three';
import Splash from './components/Splash.vue';
import Login from './components/Login.vue';
import AppState, {AppStates} from './core/app-state.js';

const hooks = {[AppStates.SIGNED_OUT]: [() => console.log("Entering 'Signed out' state."), () => console.log("Leaving 'Signed out' state.")],
               [AppStates.SIGNING_IN]: [() => console.log("Entering 'Signing in' state."), () => console.log("Leaving 'Signing in' state.")],
               [AppStates.WORLD_UNLOADED]: [() => console.log("Entering 'World unloaded' state."), () => console.log("Leaving 'World unloaded' state.")],
               [AppStates.WORLD_LOADING]: [() => console.log("Entering 'World loading' state."), () => console.log("Leaving 'World loading' state.")],
               [AppStates.WORLD_LOADED]: [() => console.log("Entering 'World loaded' state."), () => console.log("Leaving 'World loaded' state.")]};

const appState = new AppState(hooks);

const handleLogin = ({username, password}) => {

    appState.signIn();

    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const request = new Request(import.meta.env.VITE_SERVER_URL+'/api/login', {
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
        console.log(json);
        appState.toWorldSelection();
    })
    .catch(error => {
        appState.failedSigningIn();
    });

};

</script>

<template>
    <Splash msg="Wide Worlds" />
    <Login @submit="handleLogin" />
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
