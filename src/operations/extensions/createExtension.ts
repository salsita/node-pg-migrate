import type { MigrationOptions } from '../../migrationOptions';
import { toArray } from '../../utils';
import type { IfNotExistsOption, Reversible } from '../generalTypes';
import type { DropExtensionOptions } from './dropExtension';
import { dropExtension } from './dropExtension';
import type { StringExtension } from './shared';

export interface CreateExtensionOptions extends IfNotExistsOption {
  schema?: string;
}

export type CreateExtensionFn = (
  extension: StringExtension | StringExtension[],
  extensionOptions?: CreateExtensionOptions & DropExtensionOptions
) => string | string[];

export type CreateExtension = Reversible<CreateExtensionFn>;

export function createExtension(mOptions: MigrationOptions): CreateExtension {
  const _create: CreateExtension = (_extensions, options = {}) => {
    const { ifNotExists = false, schema } = options;

    const extensions = toArray(_extensions);
    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : '';
    const schemaStr = schema ? ` SCHEMA ${mOptions.literal(schema)}` : '';

    return extensions.map((extension) => {
      const extensionStr = mOptions.literal(extension);

      return `CREATE EXTENSION${ifNotExistsStr} ${extensionStr}${schemaStr};`;
    });
  };

  _create.reverse = dropExtension(mOptions);

  return _create;
}
