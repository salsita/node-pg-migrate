import type { MigrationOptions } from '../../migrationOptions';
import { toArray } from '../../utils';
import type {
  AllSequencesOptions,
  CommonOnSequencesOptions,
  RevokeOnObjectsOptions,
  SomeSequencesOptions,
} from './shared';
import { asRolesStr, asSequencesStr } from './shared';

export type RevokeOnSequencesOptions = CommonOnSequencesOptions &
  (AllSequencesOptions | SomeSequencesOptions) &
  RevokeOnObjectsOptions;

export type RevokeOnSequences = (
  revokeOptions: RevokeOnSequencesOptions
) => string;

export function revokeOnSequences(
  mOptions: MigrationOptions
): RevokeOnSequences {
  const _revokeOnSequences: RevokeOnSequences = (options) => {
    const {
      privileges,
      roles,
      onlyGrantOption = false,
      cascade = false,
    } = options;

    const rolesStr = asRolesStr(roles, mOptions);
    const privilegesStr = toArray(privileges).map(String).join(', ');
    const sequencesStr = asSequencesStr(options, mOptions);
    const onlyGrantOptionStr = onlyGrantOption ? ' GRANT OPTION FOR' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';

    return `REVOKE${onlyGrantOptionStr} ${privilegesStr} ON ${sequencesStr} FROM ${rolesStr}${cascadeStr};`;
  };

  return _revokeOnSequences;
}
