import type { MigrationOptions } from '../../types';
import { escapeValue } from '../../utils';
import type { IfNotExistsOption, Name, Value } from '../generalTypes';

export interface AddTypeValueOptions extends IfNotExistsOption {
  before?: string;

  after?: string;
}

export type AddTypeValue = (
  typeName: Name,
  value: Value,
  options?: AddTypeValueOptions
) => string | string[];

export function addTypeValue(mOptions: MigrationOptions): AddTypeValue {
  const _add: AddTypeValue = (typeName, value, options = {}) => {
    const { ifNotExists, before, after } = options;

    if (before && after) {
      throw new Error('"before" and "after" can\'t be specified together');
    }

    const beforeStr = before ? ` BEFORE ${escapeValue(before)}` : '';
    const afterStr = after ? ` AFTER ${escapeValue(after)}` : '';
    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : '';
    const valueStr = escapeValue(value);
    const typeNameStr = mOptions.literal(typeName);

    return `ALTER TYPE ${typeNameStr} ADD VALUE${ifNotExistsStr} ${valueStr}${beforeStr}${afterStr};`;
  };

  return _add;
}
