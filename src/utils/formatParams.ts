import { applyType, escapeValue } from '.';
import type { FunctionParam } from '../operations/functionsTypes';
import type { MigrationOptions } from '../types';

function formatParam(mOptions: MigrationOptions) {
  return (param: FunctionParam) => {
    const {
      mode,
      name,
      type,
      default: defaultValue,
    } = applyType(param, mOptions.typeShorthands);

    const options: string[] = [];

    if (mode) {
      options.push(mode);
    }

    if (name) {
      options.push(mOptions.literal(name));
    }

    if (type) {
      options.push(type);
    }

    if (defaultValue) {
      options.push(`DEFAULT ${escapeValue(defaultValue)}`);
    }

    return options.join(' ');
  };
}

export function formatParams(
  params: FunctionParam[],
  mOptions: MigrationOptions
): string {
  return `(${params.map(formatParam(mOptions)).join(', ')})`;
}
