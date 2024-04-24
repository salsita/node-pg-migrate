import type { MigrationOptions } from '../../types';
import type { Name, Reversible } from '../generalTypes';
import type { DropCastOptions } from './dropCast';
import { dropCast } from './dropCast';

export type CreateCastOptions = {
  functionName?: Name;
  argumentTypes?: string[];
  inout?: boolean;
  as?: 'assignment' | 'implicit';
};

export type CreateCastFn = (
  fromType: string,
  toType: string,
  options: CreateCastOptions & DropCastOptions
) => string;

export type CreateCast = Reversible<CreateCastFn>;

export function createCast(mOptions: MigrationOptions): CreateCast {
  const _create: CreateCast = (sourceType, targetType, options = {}) => {
    const { functionName, argumentTypes, inout, as } = options;

    let conversion = '';
    if (functionName) {
      const args = argumentTypes || [sourceType];
      conversion = ` WITH FUNCTION ${mOptions.literal(functionName)}(${args.join(', ')})`;
    } else if (inout) {
      conversion = ' WITH INOUT';
    } else {
      conversion = ' WITHOUT FUNCTION';
    }

    const implicit = as ? ` AS ${as}` : '';

    return `CREATE CAST (${sourceType} AS ${targetType})${conversion}${implicit};`;
  };

  _create.reverse = dropCast(mOptions);

  return _create;
}
