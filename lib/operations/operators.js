import { opSchemalize, schemalize, formatParams, applyType } from '../utils';

export const createOperator = (operatorName, options = {}) => {
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
  return `CREATE OPERATOR ${opSchemalize(operatorName)} (${defs.join(', ')});`;
};

export const dropOperator = (operatorName, options = {}) => {
  const {
    ifExists,
    cascade,
    left,
    right,
  } = options;

  const leftType = left || 'none';
  const rightType = right || 'none';

  return `DROP OPERATOR${ifExists ? ' IF EXISTS' : ''} ${opSchemalize(operatorName)}(${schemalize(leftType)}, ${schemalize(rightType)})${cascade ? ' CASCADE' : ''};`;
};


export const createOperatorFamily = (operatorFamilyName, indexMethod) =>
  `CREATE OPERATOR FAMILY ${schemalize(operatorFamilyName)} USING ${indexMethod};`;

export const dropOperatorFamily = (operatorFamilyName, indexMethod, { ifExists, cascade } = {}) => // eslint-disable-line max-len
  `DROP OPERATOR FAMILY ${ifExists ? ' IF EXISTS' : ''} ${schemalize(operatorFamilyName)} USING ${indexMethod}${cascade ? ' CASCADE' : ''};`;

const operatorMap = typeShorthands => ({
  type = '',
  number,
  name,
  params = [],
}) => {
  if (String(type).toLowerCase() === 'function') {
    if (params.length > 2) {
      throw new Error('Operator can\'t have more than 2 parameters');
    }
    return `OPERATOR ${number} ${opSchemalize(name)}${params.length > 0 ? formatParams(params, typeShorthands) : ''}`;
  } else if (String(type).toLowerCase() === 'operator') {
    return `FUNCTION ${number} ${schemalize(name)}${formatParams(params, typeShorthands)}`;
  }
  throw new Error('Operator "type" must be either "function" or "operator"');
};

export const removeFromOperatorFamily = typeShorthands =>
  (operatorFamilyName, indexMethod, operatorList) =>
    `ALTER OPERATOR FAMILY ${schemalize(operatorFamilyName)} USING ${indexMethod} DROP
  ${operatorList.map(operatorMap(typeShorthands)).join(',\n  ')};`;

export const addToOperatorFamily = (typeShorthands) => {
  const _add = (operatorFamilyName, indexMethod, operatorList) =>
    `ALTER OPERATOR FAMILY ${schemalize(operatorFamilyName)} USING ${indexMethod} ADD
    ${operatorList.map(operatorMap(typeShorthands)).join(',\n  ')};`;
  _add.reverse = removeFromOperatorFamily(typeShorthands);
  return _add;
};

export const renameOperatorFamily = (oldOperatorFamilyName, indexMethod, newOperatorFamilyName) => // eslint-disable-line max-len
  `ALTER OPERATOR FAMILY ${schemalize(oldOperatorFamilyName)} USING ${indexMethod} RENAME TO ${schemalize(newOperatorFamilyName)};`;

const undoRenameOperatorFamily = (oldOperatorFamilyName, indexMethod, newOperatorFamilyName) => // eslint-disable-line max-len
  renameOperatorFamily(newOperatorFamilyName, indexMethod, oldOperatorFamilyName);


export const dropOperatorClass = (operatorClassName, indexMethod, { ifExists, cascade } = {}) => // eslint-disable-line max-len
  `DROP OPERATOR CLASS ${ifExists ? ' IF EXISTS' : ''} ${schemalize(operatorClassName)} USING ${indexMethod}${cascade ? ' CASCADE' : ''};`;

export const createOperatorClass = (typeShorthands) => {
  const _create = (operatorClassName, type, indexMethod, operatorList, options) => {
    const {
      default: isDefault,
      family,
    } = options;
    return `CREATE OPERATOR CLASS ${schemalize(operatorClassName)}${isDefault ? ' DEFAULT' : ''} FOR TYPE ${schemalize(applyType(type).type)} USING ${schemalize(indexMethod)} ${family ? ` FAMILY ${family}` : ''} AS
  ${operatorList.map(operatorMap(typeShorthands)).join(',\n  ')};`;
  };
  _create.reverse = (operatorClassName, type, indexMethod, operatorList, options) =>
    dropOperatorClass(operatorClassName, indexMethod, options);
  return _create;
};

export const renameOperatorClass = (oldOperatorClassName, indexMethod, newOperatorClassName) => // eslint-disable-line max-len
  `ALTER OPERATOR CLASS ${schemalize(oldOperatorClassName)} USING ${indexMethod} RENAME TO ${schemalize(newOperatorClassName)};`;

const undoRenameOperatorClass = (oldOperatorClassName, indexMethod, newOperatorClassName) => // eslint-disable-line max-len
  renameOperatorClass(newOperatorClassName, indexMethod, oldOperatorClassName);

// setup reverse functions
createOperator.reverse = dropOperator;
createOperatorFamily.reverse = dropOperatorFamily;
renameOperatorFamily.reverse = undoRenameOperatorFamily;
renameOperatorClass.reverse = undoRenameOperatorClass;
