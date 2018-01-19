import _ from 'lodash';
import { template, applyType, escapeValue } from '../utils';

export const drop = (type_name, { ifExists, cascade } = {}) =>
  template`DROP TYPE${ifExists ? ' IF EXISTS' : ''} "${type_name}"${cascade ? ' CASCADE' : ''};`;

export const create = (type_shorthands) => {
  const _create = (type_name, options) => {
    if (_.isArray(options)) {
      return template`CREATE TYPE "${type_name}" AS ENUM (${options.map(escapeValue).join(', ')});`;
    }
    const attributes = _.map(options, (attribute, attribute_name) =>
      template`"${attribute_name}" ${applyType(attribute, type_shorthands).type}`
    ).join(',\n');
    return template`CREATE TYPE "${type_name}" AS (\n${attributes}\n);`;
  };
  _create.reverse = drop;
  return _create;
};

export const dropTypeAttribute = (type_name, attribute_name, { ifExists } = {}) =>
  template`ALTER TYPE "${type_name}" DROP ATTRIBUTE "${attribute_name}"${ifExists ? ' IF EXISTS' : ''};`;

export const addTypeAttribute = (type_shorthands) => {
  const _alterAttributeAdd = (type_name, attribute_name, attribute_type) =>
    template`ALTER TYPE "${type_name}" ADD ATTRIBUTE "${attribute_name}" ${applyType(attribute_type, type_shorthands).type};`;
  _alterAttributeAdd.reverse = dropTypeAttribute;
  return _alterAttributeAdd;
};

export const setTypeAttribute = type_shorthands =>
  (type_name, attribute_name, attribute_type) =>
    template`ALTER TYPE "${type_name}" ALTER ATTRIBUTE "${attribute_name}" SET DATA TYPE ${applyType(attribute_type, type_shorthands).type};`;

export const addTypeValue = (type_name, value, options = {}) => {
  const {
    ifNotExists,
    before,
    after,
  } = options;

  if (before && after) {
    throw new Error('"before" and "after" can\'t be specified together');
  }
  const beforeClause = before ? ` BEFORE ${before}` : '';
  const afterClause = after ? ` AFTER ${after}` : '';

  return template`ALTER TYPE "${type_name}" ADD VALUE${ifNotExists ? ' IF NOT EXISTS' : ''} ${escapeValue(value)}${beforeClause}${afterClause};`;
};

// RENAME
export const rename = (type_name, new_type_name) =>
  template`ALTER TYPE  "${type_name}" RENAME TO "${new_type_name}";`;

export const undoRename = (type_name, new_type_name) =>
  rename(new_type_name, type_name);

export const renameTypeAttribute = (type_name, attribute_name, new_attribute_name) =>
  template`ALTER TYPE "${type_name}" RENAME ATTRIBUTE "${attribute_name}" TO "${new_attribute_name}";`;

export const undoRenameTypeAttribute = (type_name, attribute_name, new_attribute_name) =>
  renameTypeAttribute(type_name, new_attribute_name, attribute_name);

rename.reverse = undoRename;
renameTypeAttribute.reverse = undoRenameTypeAttribute;
