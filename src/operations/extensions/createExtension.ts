import type { MigrationOptions } from '../../types';
import type { DropOptions, IfNotExistsOption } from '../generalTypes';
import { dropExtension } from './dropExtension';
import type { StringExtension } from './shared';

export interface CreateExtensionOptions extends IfNotExistsOption {
  schema?: string;
}

export type CreateExtensionFn = (
  extension: StringExtension | StringExtension[],
  options?: CreateExtensionOptions & DropOptions
) => string | string[];

export type CreateExtension = CreateExtensionFn & {
  reverse: CreateExtensionFn;
};

export function createExtension(mOptions: MigrationOptions): CreateExtension {
  const _create: CreateExtension = (_extensions, options = {}) => {
    const { ifNotExists, schema } = options;

    const extensions = Array.isArray(_extensions) ? _extensions : [_extensions];
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
