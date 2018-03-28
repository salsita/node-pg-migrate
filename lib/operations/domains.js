import { template, applyType, escapeValue } from "../utils";

export const dropDomain = (domainName, { ifExists, cascade } = {}) =>
  template`DROP DOMAIN${ifExists ? " IF EXISTS" : ""} "${domainName}"${
    cascade ? " CASCADE" : ""
  };`;

export const createDomain = typeShorthands => {
  const _create = (domainName, type, options) => {
    const {
      default: defaultValue,
      collation,
      notNull,
      check,
      constraintName
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
        constraints.push("NOT NULL");
      } else if (check) {
        constraints.push(`CHECK (${check})`);
      }
    }

    const constraintsString = constraints.length
      ? ` ${constraints.join(" ")}`
      : "";

    return template`CREATE DOMAIN "${domainName}" AS ${
      applyType(type, typeShorthands).type
    }${constraintsString};`;
  };
  _create.reverse = (domainName, type, options) =>
    dropDomain(domainName, options);
  return _create;
};

export const alterDomain = (domainName, options) => {
  const {
    default: defaultValue,
    notNull,
    allowNull,
    check,
    constraintName
  } = options;
  const actions = [];
  if (defaultValue === null) {
    actions.push("DROP DEFAULT");
  } else if (defaultValue !== undefined) {
    actions.push(`SET DEFAULT ${escapeValue(defaultValue)}`);
  }
  if (notNull) {
    actions.push("SET NOT NULL");
  } else if (notNull === false || allowNull) {
    actions.push("DROP NOT NULL");
  }
  if (check) {
    actions.push(
      `${constraintName ? `CONSTRAINT ${constraintName} ` : ""}CHECK (${check})`
    );
  }

  return `${actions
    .map(action => template`ALTER DOMAIN "${domainName}" ${action}`)
    .join(";\n")};`;
};

// RENAME
export const renameDomain = (domainName, newDomainName) =>
  template`ALTER DOMAIN  "${domainName}" RENAME TO "${newDomainName}";`;

const undoRename = (domainName, newDomainName) =>
  renameDomain(newDomainName, domainName);

renameDomain.reverse = undoRename;
