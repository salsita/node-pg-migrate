import { applyType, escapeValue } from '.';
import type { MigrationOptions } from '../migrationOptions';
import type { FunctionParam } from '../operations/functions';

function formatParam(
  mOptions: MigrationOptions
): (param: FunctionParam) => string {
  return (param) => {
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
  params: ReadonlyArray<FunctionParam>,
  mOptions: MigrationOptions
): string {
  return `(${params.map(formatParam(mOptions)).join(', ')})`;
}
