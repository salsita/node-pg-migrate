import type { MigrationOptions } from '../../migrationOptions';
import { escapeValue } from '../../utils';
import type { Name } from '../generalTypes';
import { warnAmbiguousNullability } from '../warnAmbiguousNullability';
import type { DomainOptions } from './shared';

export interface AlterDomainOptions extends DomainOptions {
  /**
   * Drop NOT NULL when true. False is ignored and warns unless notNull is true.
   * notNull takes precedence when both options are supplied.
   */
  allowNull?: boolean;
}

export type AlterDomain = (
  domainName: Name,
  domainOptions: AlterDomainOptions
) => string;

export function alterDomain(mOptions: MigrationOptions): AlterDomain {
  const _alter: AlterDomain = (domainName, options) => {
    const {
      default: defaultValue,
      notNull,
      allowNull,
      check,
      constraintName,
    } = options;

    const actions: string[] = [];

    warnAmbiguousNullability(
      mOptions.logger,
      () => `alterDomain ${mOptions.literal(domainName)}`,
      { notNull, allowNull }
    );

    if (defaultValue === null) {
      actions.push('DROP DEFAULT');
    } else if (defaultValue !== undefined) {
      actions.push(`SET DEFAULT ${escapeValue(defaultValue)}`);
    }

    if (notNull) {
      actions.push('SET NOT NULL');
    } else if (notNull === false || allowNull) {
      actions.push('DROP NOT NULL');
    }

    if (check) {
      actions.push(
        `ADD ${constraintName ? `CONSTRAINT ${mOptions.literal(constraintName)} ` : ''}CHECK (${check})`
      );
    }

    return `${actions.map((action) => `ALTER DOMAIN ${mOptions.literal(domainName)} ${action}`).join(';\n')};`;
  };

  return _alter;
}
