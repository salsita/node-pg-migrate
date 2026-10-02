import type { MigrationOptions } from '../../migrationOptions';
import { toArray } from '../../utils';
import type { Reversible } from '../generalTypes';
import { revokeOnSequences } from './revokeOnSequences';
import type {
  AllSequencesOptions,
  CommonGrantOnSequencesOptions,
  RevokeOnObjectsOptions,
  SomeSequencesOptions,
} from './shared';
import { asRolesStr, asSequencesStr } from './shared';

export type GrantOnSomeSequencesOptions = CommonGrantOnSequencesOptions &
  SomeSequencesOptions;

export type GrantOnAllSequencesOptions = CommonGrantOnSequencesOptions &
  AllSequencesOptions;

export type GrantOnSequencesOptions = (
  | GrantOnSomeSequencesOptions
  | GrantOnAllSequencesOptions
) &
  RevokeOnObjectsOptions;

export type GrantOnSequencesFn = (
  grantOptions: GrantOnSequencesOptions
) => string;

export type GrantOnSequences = Reversible<GrantOnSequencesFn>;

export function grantOnSequences(mOptions: MigrationOptions): GrantOnSequences {
  const _grantOnSequences: GrantOnSequences = (options) => {
    const { privileges, roles, withGrantOption = false } = options;

    const rolesStr = asRolesStr(roles, mOptions);
    const privilegesStr = toArray(privileges).map(String).join(', ');
    const sequencesStr = asSequencesStr(options, mOptions);
    const withGrantOptionStr = withGrantOption ? ' WITH GRANT OPTION' : '';

    return `GRANT ${privilegesStr} ON ${sequencesStr} TO ${rolesStr}${withGrantOptionStr};`;
  };

  _grantOnSequences.reverse = revokeOnSequences(mOptions);

  return _grantOnSequences;
}
