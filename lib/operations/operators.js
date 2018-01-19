import { opSchemalize, schemalize, formatParams, applyType } from '../utils';

export const createOperator = (operator_name, options = {}) => {
  const {
    procedure,
    left,
    right,
    commutator,
    negator,
    restrict,
    join,
    hashes,
    merges,
  } = options;

  const defs = [];
  defs.push(`PROCEDURE = ${schemalize(procedure)}`);
  if (left) {
    defs.push(`LEFTARG = ${schemalize(left)}`);
  }
  if (right) {
    defs.push(`RIGHTARG = ${schemalize(right)}`);
  }
  if (commutator) {
    defs.push(`COMMUTATOR = ${opSchemalize(commutator)}`);
  }
  if (negator) {
    defs.push(`NEGATOR = ${opSchemalize(negator)}`);
  }
  if (restrict) {
    defs.push(`RESTRICT = ${schemalize(restrict)}`);
  }
  if (join) {
    defs.push(`JOIN = ${schemalize(join)}`);
  }
  if (hashes) {
    defs.push('HASHES');
  }
  if (merges) {
    defs.push('MERGES');
  }
  return `CREATE OPERATOR ${opSchemalize(operator_name)} (${defs.join(', ')});`;
};

export const dropOperator = (operator_name, options = {}) => {
  const {
    ifExists,
    cascade,
    left,
    right,
  } = options;

  const leftType = left || 'none';
  const rightType = right || 'none';

  return `DROP OPERATOR${ifExists ? ' IF EXISTS' : ''} ${opSchemalize(operator_name)}(${schemalize(leftType)}, ${schemalize(rightType)})${cascade ? ' CASCADE' : ''};`;
};


export const createOperatorFamily = (operator_family_name, index_method) =>
  `CREATE OPERATOR FAMILY ${schemalize(operator_family_name)} USING ${index_method};`;

export const dropOperatorFamily = (operator_family_name, index_method, { ifExists, cascade } = {}) => // eslint-disable-line max-len
  `DROP OPERATOR FAMILY ${ifExists ? ' IF EXISTS' : ''} ${schemalize(operator_family_name)} USING ${index_method}${cascade ? ' CASCADE' : ''};`;

const operatorMap = type_shorthands => ({
  type = '',
  number,
  name,
  params = [],
}) => {
  if (String(type).toLowerCase() === 'function') {
    if (params.length > 2) {
      throw new Error('Operator can\'t have more than 2 parameters');
    }
    return `OPERATOR ${number} ${opSchemalize(name)}${params.length > 0 ? formatParams(params, type_shorthands) : ''}`;
  } else if (String(type).toLowerCase() === 'operator') {
    return `FUNCTION ${number} ${schemalize(name)}${formatParams(params, type_shorthands)}`;
  }
  throw new Error('Operator "type" must be either "function" or "operator"');
};

export const removeFromOperatorFamily = type_shorthands =>
  (operator_family_name, index_method, operator_list) =>
    `ALTER OPERATOR FAMILY ${schemalize(operator_family_name)} USING ${index_method} DROP
  ${operator_list.map(operatorMap(type_shorthands)).join(',\n  ')};`;

export const addToOperatorFamily = (type_shorthands) => {
  const _add = (operator_family_name, index_method, operator_list) =>
    `ALTER OPERATOR FAMILY ${schemalize(operator_family_name)} USING ${index_method} ADD
    ${operator_list.map(operatorMap(type_shorthands)).join(',\n  ')};`;
  _add.reverse = removeFromOperatorFamily(type_shorthands);
  return _add;
};

export const renameOperatorFamily = (old_operator_family_name, index_method, new_operator_family_name) => // eslint-disable-line max-len
  `ALTER OPERATOR FAMILY ${schemalize(old_operator_family_name)} USING ${index_method} RENAME TO ${schemalize(new_operator_family_name)};`;

const undoRenameOperatorFamily = (old_operator_family_name, index_method, new_operator_family_name) => // eslint-disable-line max-len
  renameOperatorFamily(new_operator_family_name, index_method, old_operator_family_name);


export const dropOperatorClass = (operator_class_name, index_method, { ifExists, cascade } = {}) => // eslint-disable-line max-len
  `DROP OPERATOR CLASS ${ifExists ? ' IF EXISTS' : ''} ${schemalize(operator_class_name)} USING ${index_method}${cascade ? ' CASCADE' : ''};`;

export const createOperatorClass = (type_shorthands) => {
  const _create = (operator_class_name, type, index_method, operator_list, options) => {
    const {
      default: isDefault,
      family,
    } = options;
    return `CREATE OPERATOR CLASS ${schemalize(operator_class_name)}${isDefault ? ' DEFAULT' : ''} FOR TYPE ${schemalize(applyType(type).type)} USING ${schemalize(index_method)} ${family ? ` FAMILY ${family}` : ''} AS
  ${operator_list.map(operatorMap(type_shorthands)).join(',\n  ')};`;
  };
  _create.reverse = (operator_class_name, type, index_method, operator_list, options) =>
    dropOperatorClass(operator_class_name, index_method, options);
  return _create;
};

export const renameOperatorClass = (old_operator_class_name, index_method, new_operator_class_name) => // eslint-disable-line max-len
  `ALTER OPERATOR CLASS ${schemalize(old_operator_class_name)} USING ${index_method} RENAME TO ${schemalize(new_operator_class_name)};`;

const undoRenameOperatorClass = (old_operator_class_name, index_method, new_operator_class_name) => // eslint-disable-line max-len
  renameOperatorClass(new_operator_class_name, index_method, old_operator_class_name);

// setup reverse functions
createOperator.reverse = dropOperator;
createOperatorFamily.reverse = dropOperatorFamily;
renameOperatorFamily.reverse = undoRenameOperatorFamily;
renameOperatorClass.reverse = undoRenameOperatorClass;
