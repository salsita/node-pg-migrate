import { template, applyType, escapeValue } from '../utils';

export const drop = (domain_name, { ifExists, cascade } = {}) =>
  template`DROP DOMAIN${ifExists ? ' IF EXISTS' : ''} "${domain_name}"${cascade ? ' CASCADE' : ''};`;

export const create = (type_shorthands) => {
  const _create = (domain_name, type, options) => {
    const {
      default: defaultValue,
      collation,
      notNull,
      check,
      constraintName,
    } = options;
    const constraints = [];
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
        constraints.push(`CONSTRAINT ${constraintName}`);
      }
      if (notNull) {
        constraints.push('NOT NULL');
      } else if (check) {
        constraints.push(`CHECK (${check})`);
      }
    }

    const constraintsString = constraints.length ? ` ${constraints.join(' ')}` : '';

    return template`CREATE DOMAIN "${domain_name}" AS ${applyType(type, type_shorthands).type}${constraintsString};`;
  };
  _create.reverse = drop;
  return _create;
};

export const alter = (domain_name, options) => {
  const {
    default: defaultValue,
    notNull,
    allowNull,
    check,
    constraintName,
  } = options;
  const actions = [];
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
    actions.push(`${constraintName ? `CONSTRAINT ${constraintName} ` : ''}CHECK (${check})`);
  }

  return `${actions.map(action => template`ALTER DOMAIN "${domain_name}" ${action}`).join(';\n')};`;
};

// RENAME
export const rename = (domain_name, new_domain_name) =>
  template`ALTER DOMAIN  "${domain_name}" RENAME TO "${new_domain_name}";`;

export const undoRename = (domain_name, new_domain_name) =>
  rename(new_domain_name, domain_name);

rename.reverse = undoRename;
