import type { MigrationOptions } from '../../migrationOptions';
import { createRenameOperation } from '../createRenameOperation';
import type { Name, Reversible } from '../generalTypes';

export type RenameDomainFn = (
  oldDomainName: Name,
  newDomainName: Name
) => string;

export type RenameDomain = Reversible<RenameDomainFn>;

export function renameDomain(mOptions: MigrationOptions): RenameDomain {
  return createRenameOperation(mOptions, {
    operation: 'renameDomain',
    keyword: 'DOMAIN',
    label: 'a domain',
  });
}
