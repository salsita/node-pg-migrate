import { applyType, escapeValue } from '.';
import type { MigrationOptions } from '../migrationOptions';
import type { FunctionParam } from '../operations/functions';

function formatParam(
  mOptions: MigrationOptions,
  includeDefaults: boolean
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

    if (includeDefaults && defaultValue !== undefined) {
      options.push(`DEFAULT ${escapeValue(defaultValue)}`);
    }

    return options.join(' ');
  };
}

export function formatParams(
  params: ReadonlyArray<FunctionParam>,
  mOptions: MigrationOptions
): string {
  return `(${params.map(formatParam(mOptions, true)).join(', ')})`;
}

/** Format a function identity without defaults, including shorthand defaults. */
export function formatFunctionIdentityParams(
  params: ReadonlyArray<FunctionParam>,
  mOptions: MigrationOptions
): string {
  return `(${params.map(formatParam(mOptions, false)).join(', ')})`;
}
