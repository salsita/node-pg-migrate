import _ from 'lodash';
import { template, applyType } from '../utils';

export const drop = type_name =>
  template`DROP TYPE "${type_name}";`;

export const create = (type_shorthands) => {
  const _create = (type_name, options) => {
    if (_.isArray(options)) {
      return template`CREATE TYPE "${type_name}" AS ENUM ('${options.join('\', \'')}');`;
    }
    const columns = _.map(options, (column, column_name) =>
      template`"${column_name}" ${applyType(column, type_shorthands).type}`
    ).join(',\n');
    return template`CREATE TYPE "${type_name}" AS (\n${columns}\n);`;
  };
  _create.reverse = drop;
  return _create;
};

export const alter = () => null;
