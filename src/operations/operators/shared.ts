import type { MigrationOptions } from '../../migrationOptions';
import { formatParams } from '../../utils';
import type { FunctionParam } from '../functions';
import type { Name } from '../generalTypes';

export interface OperatorListDefinition {
  type: 'function' | 'operator';

  number: number;

  name: Name;

  params?: FunctionParam[];
}

export function operatorMap(
  mOptions: MigrationOptions
): ({ type, number, name, params }: OperatorListDefinition) => string {
  return ({ type, number, name, params = [] }) => {
    const nameStr = mOptions.literal(name);

    if (String(type).toLowerCase() === 'operator') {
      if (params.length > 2) {
        throw new Error("Operator can't have more than 2 parameters");
      }

      const paramsStr = params.length > 0 ? formatParams(params, mOptions) : '';

      return `OPERATOR ${number} ${nameStr}${paramsStr}`;
    }

    if (String(type).toLowerCase() === 'function') {
      const paramsStr = formatParams(params, mOptions);

      return `FUNCTION ${number} ${nameStr}${paramsStr}`;
    }

    throw new Error('Operator "type" must be either "function" or "operator"');
  };
}
