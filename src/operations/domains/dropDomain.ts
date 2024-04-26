import type { MigrationOptions } from '../../types';
import type { DropOptions, Name } from '../generalTypes';

export type DropDomain = (
  domainName: Name,
  dropOptions?: DropOptions
) => string;

export function dropDomain(mOptions: MigrationOptions): DropDomain {
  const _drop: DropDomain = (domainName, options = {}) => {
    const { ifExists, cascade } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const domainNameStr = mOptions.literal(domainName);

    return `DROP DOMAIN${ifExistsStr} ${domainNameStr}${cascadeStr};`;
  };

  return _drop;
}
