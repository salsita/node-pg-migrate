import type { MigrationOptions } from '../../types';
import { applyType, escapeValue } from '../../utils';
import type { DropOptions, Name, Type, Value } from '../generalTypes';
import { dropType } from './dropType';

export type CreateTypeFn = (
  typeName: Name,
  values: (Value[] | { [name: string]: Type }) & DropOptions
) => string | string[];

export type CreateType = CreateTypeFn & { reverse: CreateTypeFn };

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
