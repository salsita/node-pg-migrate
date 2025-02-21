import type { MigrationOptions } from '../../migrationOptions';
import { escapeValue } from '../../utils';
import type { Name } from '../generalTypes';
import type { DomainOptions } from './shared';

export interface AlterDomainOptions extends DomainOptions {
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
      allowNull = false,
      check,
      constraintName,
    } = options;

    const actions: string[] = [];

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
        `${constraintName ? `CONSTRAINT ${mOptions.literal(constraintName)} ` : ''}CHECK (${check})`
      );
    }

    return `${actions.map((action) => `ALTER DOMAIN ${mOptions.literal(domainName)} ${action}`).join(';\n')};`;
  };

  return _alter;
}
