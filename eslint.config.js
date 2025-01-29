import pluginVue from 'eslint-plugin-vue';
import google from 'eslint-config-google';
delete google.rules['valid-jsdoc'];
delete google.rules['require-jsdoc'];

export default [
  ...pluginVue.configs['flat/recommended'],
  google,
  {
    files: ["**/*.js", '**/*.vue'],
  }
];
