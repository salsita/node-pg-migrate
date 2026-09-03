import type { MigrationOptions } from '../../migrationOptions';
import {
  applyType,
  escapeValue,
  formatBlock,
  formatSeparator,
} from '../../utils';
import type { Name, Reversible, Type, Value } from '../generalTypes';
import type { DropTypeOptions } from './dropType';
import { dropType } from './dropType';

export type CreateTypeFn = (
  typeName: Name,
  values: Value[] | { [name: string]: Type },
  typeOptions?: DropTypeOptions
) => string;

export type CreateType = Reversible<CreateTypeFn>;

export function createType(mOptions: MigrationOptions): CreateType {
  const _create: CreateType = (typeName, values) => {
    if (Array.isArray(values)) {
      const valuesStr = values.map(escapeValue).join(', ');
      const typeNameStr = mOptions.literal(typeName);

      return `CREATE TYPE ${typeNameStr} AS ENUM (${valuesStr});`;
    }

    const attributes = Object.entries(values)
      .map(([attributeName, attribute]) => {
        const typeStr = applyType(attribute, mOptions.typeShorthands).type;

        return `${mOptions.literal(attributeName)} ${typeStr}`;
      })
      .join(`,${formatSeparator(mOptions.pretty)}`);

    return `CREATE TYPE ${mOptions.literal(typeName)} AS (${formatBlock(attributes, mOptions.pretty)});`;
  };

  _create.reverse = (typeName, values, typeOptions) =>
    dropType(mOptions)(typeName, typeOptions);

  return _create;
}
