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
    let conversion = '';
    if (options.functionName) {
      const args = options.argumentTypes || [fromType];
      conversion = ` WITH FUNCTION ${options.functionName}(${args.join(', ')})`;
    } else if (options.inout) {
      conversion = ' WITH INOUT';
    } else {
      conversion = ' WITHOUT FUNCTION';
    }

    const implicit = options.as ? ` AS ${options.as}` : '';

    return `CREATE CAST (${fromType} AS ${toType})${conversion}${implicit};`;
  };

  _create.reverse = dropCast(mOptions);

  return _create;
}
