#!/usr/bin/env node

/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {dirname} from 'path';
import {fileURLToPath} from 'url';
import swaggerJsdoc from 'swagger-jsdoc';
import YAML from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Wide Worlds',
      version: '1.0.0',
    },
  },
  apis: [`${__dirname}/../server/http*.js`],
};

const openapiSpecification = swaggerJsdoc(options);

const doc = new YAML.Document();
doc.contents = openapiSpecification;

console.log(doc.toString());
