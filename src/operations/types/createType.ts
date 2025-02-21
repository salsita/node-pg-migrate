import type { MigrationOptions } from '../../migrationOptions';
import { applyType, escapeValue } from '../../utils';
import type { Name, Reversible, Type, Value } from '../generalTypes';
import type { DropTypeOptions } from './dropType';
import { dropType } from './dropType';

export type CreateTypeFn = (
  typeName: Name,
  values: (Value[] | { [name: string]: Type }) & DropTypeOptions
) => string;

export type CreateType = Reversible<CreateTypeFn>;

export function createType(mOptions: MigrationOptions): CreateType {
  const _create: CreateType = (typeName, options) => {
    if (Array.isArray(options)) {
      const optionsStr = options.map(escapeValue).join(', ');
      const typeNameStr = mOptions.literal(typeName);

      return `CREATE TYPE ${typeNameStr} AS ENUM (${optionsStr});`;
    }

    const attributes = Object.entries(options)
      .map(([attributeName, attribute]) => {
        const typeStr = applyType(attribute, mOptions.typeShorthands).type;

        return `${mOptions.literal(attributeName)} ${typeStr}`;
      })
      .join(',\n');

    return `CREATE TYPE ${mOptions.literal(typeName)} AS (\n${attributes}\n);`;
  };

  _create.reverse = dropType(mOptions);

  return _create;
}
