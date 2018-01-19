import _ from 'lodash';
import { template } from '../utils';

export const create = (extensions) => {
  if (!_.isArray(extensions)) extensions = [extensions]; // eslint-disable-line no-param-reassign
  return _.map(extensions, extension => template`CREATE EXTENSION "${extension}";`);
};

export const drop = (extensions, { ifExists, cascade } = {}) => {
  if (!_.isArray(extensions)) extensions = [extensions]; // eslint-disable-line no-param-reassign
  return _.map(extensions, extension => template`DROP EXTENSION${ifExists ? ' IF EXISTS' : ''} "${extension}"${cascade ? ' CASCADE' : ''};`);
};

// setup reverse functions
create.reverse = drop;
