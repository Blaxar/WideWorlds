import pluginVue from 'eslint-plugin-vue';
import google from 'eslint-config-google';
delete google.rules['valid-jsdoc'];
delete google.rules['require-jsdoc'];
import jsdoc from 'eslint-plugin-jsdoc';

export default [
  ...pluginVue.configs['flat/recommended'],
  jsdoc.configs['flat/recommended-error'],
  google,
  {
    files: ["**/*.js", '**/*.vue'],
  },
  {
    files: ['**/*.js'],
    plugins: {
      jsdoc,
    },
    rules: {
      'jsdoc/check-access': 1,
      'jsdoc/check-alignment': 0,
      'jsdoc/check-examples': 0,
      'jsdoc/check-indentation': 0,
      'jsdoc/check-line-alignment': 0,
      'jsdoc/check-param-names': 1,
      'jsdoc/check-property-names': 1,
      'jsdoc/check-syntax': 1,
      'jsdoc/check-tag-names': 0,
      'jsdoc/check-template-names': 1,
      'jsdoc/check-types': 1,
      'jsdoc/check-values': 1,
      'jsdoc/empty-tags': 1,
      'jsdoc/implements-on-classes': 1,
      'jsdoc/informative-docs': 0,
      'jsdoc/match-description': 0,
      'jsdoc/multiline-blocks': 1,
      'jsdoc/no-bad-blocks': 1,
      'jsdoc/no-blank-block-descriptions': 1,
      'jsdoc/no-defaults': 1,
      'jsdoc/no-missing-syntax': 0,
      'jsdoc/no-multi-asterisks': 1,
      'jsdoc/no-restricted-syntax': 0,
      'jsdoc/no-types': 0,
      'jsdoc/no-undefined-types': 0,
      'jsdoc/require-asterisk-prefix': 1,
      'jsdoc/require-description': 0,
      'jsdoc/require-description-complete-sentence': 0,
      'jsdoc/require-example': 0,
      'jsdoc/require-file-overview': 0,
      'jsdoc/require-hyphen-before-param-description': 1,
      'jsdoc/require-jsdoc': 1,
      'jsdoc/require-param-description': 1,
      'jsdoc/require-param-name': 1,
      'jsdoc/require-param-type': 1,
      'jsdoc/require-param': 1,
      'jsdoc/require-property-description': 1,
      'jsdoc/require-property-name': 1,
      'jsdoc/require-property-type': 1,
      'jsdoc/require-property': 1,
      'jsdoc/require-returns-check': 1,
      'jsdoc/require-returns-description': 1,
      'jsdoc/require-returns-type': 1,
      'jsdoc/require-returns': 0,
      'jsdoc/require-template': 1,
      'jsdoc/require-throws': 0,
      'jsdoc/require-yields-check': 1,
      'jsdoc/require-yields': 0,
      'jsdoc/sort-tags': 1,
      'jsdoc/tag-lines': 0,
      'jsdoc/valid-types': 1
    }
  }
];
