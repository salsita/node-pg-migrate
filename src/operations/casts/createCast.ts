import type { MigrationOptions } from '../../types';
import type { DropOptions, Reversible } from '../generalTypes';
import { dropCast } from './dropCast';

export type CreateCastOptions = {
  functionName?: string;
  argumentTypes?: string[];
  inout?: boolean;
  as?: 'assignment' | 'implicit';
};

export type CreateCastFn = (
  fromType: string,
  toType: string,
  options: CreateCastOptions & DropOptions
) => string;

export type CreateCast = Reversible<CreateCastFn>;

export function createCast(mOptions: MigrationOptions): CreateCast {
  const _create: CreateCast = (fromType, toType, options = {}) => {
    const { functionName, argumentTypes, inout, as } = options;

    let conversion = '';
    if (functionName) {
      const args = argumentTypes || [fromType];
      conversion = ` WITH FUNCTION ${functionName}(${args.join(', ')})`;
    } else if (inout) {
      conversion = ' WITH INOUT';
    } else {
      conversion = ' WITHOUT FUNCTION';
    }

    const implicit = as ? ` AS ${as}` : '';

    return `CREATE CAST (${fromType} AS ${toType})${conversion}${implicit};`;
  };

  _create.reverse = dropCast(mOptions);

  return _create;
}
