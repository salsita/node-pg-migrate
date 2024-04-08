import type { MigrationOptions } from '../../types';
import { applyType, escapeValue } from '../../utils';
import type { DropOptions, Name, Type } from '../generalTypes';
import { dropDomain } from './dropDomain';
import type { DomainOptions } from './shared';

export interface DomainOptionsCreate extends DomainOptions {
  collation?: string;
}

export type CreateDomainFn = (
  domainName: Name,
  type: Type,
  domainOptions?: DomainOptionsCreate & DropOptions
) => string | string[];

export type CreateDomain = CreateDomainFn & { reverse: CreateDomainFn };

export function createDomain(mOptions: MigrationOptions): CreateDomain {
  const _create: CreateDomain = (domainName, type, options = {}) => {
    const {
      default: defaultValue,
      collation,
      notNull,
      check,
      constraintName,
    } = options;

    const constraints: string[] = [];

    if (collation) {
      constraints.push(`COLLATE ${collation}`);
    }

    if (defaultValue !== undefined) {
      constraints.push(`DEFAULT ${escapeValue(defaultValue)}`);
    }

    if (notNull && check) {
      throw new Error('"notNull" and "check" can\'t be specified together');
    } else if (notNull || check) {
      if (constraintName) {
        constraints.push(`CONSTRAINT ${mOptions.literal(constraintName)}`);
      }

      if (notNull) {
        constraints.push('NOT NULL');
      } else if (check) {
        constraints.push(`CHECK (${check})`);
      }
    }

    const constraintsStr = constraints.length
      ? ` ${constraints.join(' ')}`
      : '';

    const typeStr = applyType(type, mOptions.typeShorthands).type;
    const domainNameStr = mOptions.literal(domainName);

    return `CREATE DOMAIN ${domainNameStr} AS ${typeStr}${constraintsStr};`;
  };

  _create.reverse = (domainName, type, options) =>
    dropDomain(mOptions)(domainName, options);

  return _create;
}
