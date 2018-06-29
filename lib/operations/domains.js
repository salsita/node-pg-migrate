const { template, applyType, escapeValue } = require("../utils");

function dropDomain(domainName, { ifExists, cascade } = {}) {
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  const cascadeStr = cascade ? " CASCADE" : "";
  return template`DROP DOMAIN${ifExistsStr} "${domainName}"${cascadeStr};`;
}

function createDomain(typeShorthands) {
  const _create = (domainName, type, options = {}) => {
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

    const constraintsStr = constraints.length
      ? ` ${constraints.join(" ")}`
      : "";

    const typeStr = applyType(type, typeShorthands).type;

    return template`CREATE DOMAIN "${domainName}" AS ${typeStr}${constraintsStr};`;
  };
  _create.reverse = (domainName, type, options) =>
    dropDomain(domainName, options);
  return _create;
}

function alterDomain(domainName, options) {
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
}

function renameDomain(domainName, newDomainName) {
  return template`ALTER DOMAIN  "${domainName}" RENAME TO "${newDomainName}";`;
}

const undoRename = (domainName, newDomainName) =>
  renameDomain(newDomainName, domainName);

renameDomain.reverse = undoRename;

module.exports = {
  dropDomain,
  createDomain,
  alterDomain,
  renameDomain
};
