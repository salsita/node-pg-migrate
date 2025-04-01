import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';

export type RenameDomainFn = (
  oldDomainName: Name,
  newDomainName: Name
) => string;

export type RenameDomain = Reversible<RenameDomainFn>;

export function renameDomain(mOptions: MigrationOptions): RenameDomain {
  const _rename: RenameDomain = (domainName, newDomainName) => {
    const domainNameStr = mOptions.literal(domainName);
    const newDomainNameStr = mOptions.literal(newDomainName);

    return `ALTER DOMAIN ${domainNameStr} RENAME TO ${newDomainNameStr};`;
  };

  _rename.reverse = (domainName, newDomainName) =>
    _rename(newDomainName, domainName);

  return _rename;
}
