import { Name, DropOptions, Type } from '../definitions';
import { MigrationOptions } from '../migration-builder';
import { applyType, formatParams } from '../utils';
import { FunctionParam } from './functions';

export interface CreateOperatorOptions {
  procedure: Name;
  left?: Name;
  right?: Name;
  commutator?: Name;
  negator?: Name;
  restrict?: Name;
  join?: Name;
  hashes?: boolean;
  merges?: boolean;
}

export interface DropOperatorOptions {
  left?: Name;
  right?: Name;
  ifExists?: boolean;
  cascade?: boolean;
}

export interface CreateOperatorClassOptions {
  default?: boolean;
  family?: string;
}

export interface OperatorListDefinition {
  type: 'function' | 'operator';
  number: number;
  name: Name;
  params?: FunctionParam[];
}

export function dropOperator(mOptions: MigrationOptions) {
  const _drop = (operatorName: Name, options: DropOperatorOptions = {}) => {
    const { ifExists, cascade, left, right } = options;

    const operatorNameStr = mOptions.schemalize(operatorName);
    const leftStr = mOptions.literal(left || 'none');
    const rightStr = mOptions.literal(right || 'none');

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';

    return `DROP OPERATOR${ifExistsStr} ${operatorNameStr}(${leftStr}, ${rightStr})${cascadeStr};`;
  };
  return _drop;
}

export function createOperator(mOptions: MigrationOptions) {
  const _create = (operatorName: Name, options: Partial<CreateOperatorOptions> = {}) => {
    const {
      procedure,
      left,
      right,
      commutator,
      negator,
      restrict,
      join,
      hashes,
      merges
    } = options;

    const defs = [];
    defs.push(`PROCEDURE = ${mOptions.literal(procedure)}`);
    if (left) {
      defs.push(`LEFTARG = ${mOptions.literal(left)}`);
    }
    if (right) {
      defs.push(`RIGHTARG = ${mOptions.literal(right)}`);
    }
    if (commutator) {
      defs.push(`COMMUTATOR = ${mOptions.schemalize(commutator)}`);
    }
    if (negator) {
      defs.push(`NEGATOR = ${mOptions.schemalize(negator)}`);
    }
    if (restrict) {
      defs.push(`RESTRICT = ${mOptions.literal(restrict)}`);
    }
    if (join) {
      defs.push(`JOIN = ${mOptions.literal(join)}`);
    }
    if (hashes) {
      defs.push('HASHES');
    }
    if (merges) {
      defs.push('MERGES');
    }
    const operatorNameStr = mOptions.schemalize(operatorName);
    return `CREATE OPERATOR ${operatorNameStr} (${defs.join(', ')});`;
  };
  _create.reverse = dropOperator(mOptions);
  return _create;
}

export function dropOperatorFamily(mOptions: MigrationOptions) {
  const _drop = (
    operatorFamilyName: Name,
    indexMethod: string,
    { ifExists, cascade }: DropOptions = {}
  ) => {
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName);
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    return `DROP OPERATOR FAMILY ${ifExistsStr} ${operatorFamilyNameStr} USING ${indexMethod}${cascadeStr};`;
  };
  return _drop;
}

export function createOperatorFamily(mOptions: MigrationOptions) {
  const _create = (operatorFamilyName: Name, indexMethod: string) => {
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName);
    return `CREATE OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod};`;
  };
  _create.reverse = dropOperatorFamily(mOptions);
  return _create;
}

const operatorMap = (mOptions: MigrationOptions) => ({
  type,
  number,
  name,
  params = []
}: OperatorListDefinition) => {
  const nameStr = mOptions.literal(name);
  if (String(type).toLowerCase() === 'function') {
    if (params.length > 2) {
      throw new Error("Operator can't have more than 2 parameters");
    }
    const paramsStr = params.length > 0 ? formatParams(params, mOptions) : '';

    return `OPERATOR ${number} ${nameStr}${paramsStr}`;
  }

  if (String(type).toLowerCase() === 'operator') {
    const paramsStr = formatParams(params, mOptions);
    return `FUNCTION ${number} ${nameStr}${paramsStr}`;
  }

  throw new Error('Operator "type" must be either "function" or "operator"');
};

const changeOperatorFamily = (
  op: 'ADD' | 'DROP',
  reverse?: (mOptions: MigrationOptions) => any
) => (mOptions: MigrationOptions) => {
  const method = (
    operatorFamilyName: Name,
    indexMethod: string,
    operatorList: OperatorListDefinition[]
  ) => {
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName);
    const operatorListStr = operatorList
      .map(operatorMap(mOptions))
      .join(',\n  ');

    return `ALTER OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod} ${op}
  ${operatorListStr};`;
  };
  if (reverse) {
    method.reverse = reverse(mOptions);
  }
  return method;
};

export const removeFromOperatorFamily = changeOperatorFamily('DROP');
export const addToOperatorFamily = changeOperatorFamily(
  'ADD',
  removeFromOperatorFamily
);

export function renameOperatorFamily(mOptions: MigrationOptions) {
  const _rename = (
    oldOperatorFamilyName: Name,
    indexMethod: string,
    newOperatorFamilyName: Name
  ) => {
    const oldOperatorFamilyNameStr = mOptions.literal(oldOperatorFamilyName);
    const newOperatorFamilyNameStr = mOptions.literal(newOperatorFamilyName);

    return `ALTER OPERATOR FAMILY ${oldOperatorFamilyNameStr} USING ${indexMethod} RENAME TO ${newOperatorFamilyNameStr};`;
  };
  _rename.reverse = (
    oldOperatorFamilyName: Name,
    indexMethod: string,
    newOperatorFamilyName: Name
  ) => _rename(newOperatorFamilyName, indexMethod, oldOperatorFamilyName);
  return _rename;
}

export function dropOperatorClass(mOptions: MigrationOptions) {
  const _drop = (
    operatorClassName: Name,
    indexMethod: string,
    { ifExists, cascade }: DropOptions = {}
  ) => {
    const operatorClassNameStr = mOptions.literal(operatorClassName);
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';

    return `DROP OPERATOR CLASS ${ifExistsStr} ${operatorClassNameStr} USING ${indexMethod}${cascadeStr};`;
  };
  return _drop;
}

export function createOperatorClass(mOptions: MigrationOptions) {
  const _create = (
    operatorClassName: Name,
    type: Type,
    indexMethod: string,
    operatorList: OperatorListDefinition[],
    options: CreateOperatorClassOptions
  ) => {
    const { default: isDefault, family } = options;
    const operatorClassNameStr = mOptions.literal(operatorClassName);
    const defaultStr = isDefault ? ' DEFAULT' : '';
    const typeStr = mOptions.literal(applyType(type).type);
    const indexMethodStr = mOptions.literal(indexMethod);
    const familyStr = family ? ` FAMILY ${family}` : '';
    const operatorListStr = operatorList
      .map(operatorMap(mOptions))
      .join(',\n  ');

    return `CREATE OPERATOR CLASS ${operatorClassNameStr}${defaultStr} FOR TYPE ${typeStr} USING ${indexMethodStr} ${familyStr} AS
  ${operatorListStr};`;
  };
  _create.reverse = (
    operatorClassName: Name,
    type: Type,
    indexMethod: string,
    operatorList: OperatorListDefinition[],
    options: DropOptions
  ) => dropOperatorClass(mOptions)(operatorClassName, indexMethod, options);
  return _create;
}

export function renameOperatorClass(mOptions: MigrationOptions) {
  const _rename = (
    oldOperatorClassName: Name,
    indexMethod: string,
    newOperatorClassName: Name
  ) => {
    const oldOperatorClassNameStr = mOptions.literal(oldOperatorClassName);
    const newOperatorClassNameStr = mOptions.literal(newOperatorClassName);

    return `ALTER OPERATOR CLASS ${oldOperatorClassNameStr} USING ${indexMethod} RENAME TO ${newOperatorClassNameStr};`;
  };
  _rename.reverse = (
    oldOperatorClassName: Name,
    indexMethod: string,
    newOperatorClassName: Name
  ) => _rename(newOperatorClassName, indexMethod, oldOperatorClassName);
  return _rename;
}
