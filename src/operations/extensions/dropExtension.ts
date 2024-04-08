import type { MigrationOptions } from '../../types';
import type { DropOptions } from '../generalTypes';
import type { StringExtension } from './shared';

export type DropExtension = (
  extension: StringExtension | StringExtension[],
  dropOptions?: DropOptions
) => string | string[];

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
