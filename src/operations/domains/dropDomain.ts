import type { MigrationOptions } from '../../migrationOptions';
import type { DropOptions, Name } from '../generalTypes';

export type DropDomainOptions = DropOptions;

export type DropDomain = (
  domainName: Name,
  dropOptions?: DropDomainOptions
) => string;

export function dropDomain(mOptions: MigrationOptions): DropDomain {
  const _drop: DropDomain = (domainName, options = {}) => {
    const { ifExists = false, cascade = false } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const domainNameStr = mOptions.literal(domainName);

    return `DROP DOMAIN${ifExistsStr} ${domainNameStr}${cascadeStr};`;
  };

  return _drop;
}
