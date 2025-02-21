import type { MigrationOptions } from '../../migrationOptions';
import { toArray } from '../../utils';
import type { DropOptions } from '../generalTypes';
import type { StringExtension } from './shared';

export type DropExtensionOptions = DropOptions;

export type DropExtension = (
  extension: StringExtension | StringExtension[],
  dropOptions?: DropExtensionOptions
) => string | string[];

export function dropExtension(mOptions: MigrationOptions): DropExtension {
  const _drop: DropExtension = (_extensions, options = {}) => {
    const { ifExists = false, cascade = false } = options;

    const extensions = toArray(_extensions);
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';

    return extensions.map((extension) => {
      const extensionStr = mOptions.literal(extension);

      return `DROP EXTENSION${ifExistsStr} ${extensionStr}${cascadeStr};`;
    });
  };

  return _drop;
}
