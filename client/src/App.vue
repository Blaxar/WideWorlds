<script setup>
import * as THREE from 'three';
import Splash from './components/Splash.vue';
import Login from './components/Login.vue';

const handleLogin = ({username, password}) => {

    console.log(username, password, import.meta.env);

    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const request = new Request(import.meta.env.VITE_SERVER_URL+'/api/login', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({name: username, password: password}),
        mode: 'cors'
    });

    fetch(request).then(response => { return response.json(); })
    .then(json => { console.log(json); })
    .catch(error => { console.log(error); });

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
