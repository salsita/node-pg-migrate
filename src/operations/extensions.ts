import type { MigrationOptions } from '../types';
import type { CreateExtension, DropExtension } from './extensionsTypes';

export type { CreateExtension, DropExtension };

export function dropExtension(mOptions: MigrationOptions): DropExtension {
  const _drop: DropExtension = (_extensions, options = {}) => {
    const { ifExists, cascade } = options;
    const extensions = Array.isArray(_extensions) ? _extensions : [_extensions];
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    return extensions.map((extension) => {
      const extensionStr = mOptions.literal(extension);
      return `DROP EXTENSION${ifExistsStr} ${extensionStr}${cascadeStr};`;
    });
  };

  return _drop;
}

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
