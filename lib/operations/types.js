const _ = require("lodash");
const { template, applyType, escapeValue } = require("../utils");

function dropType(typeName, { ifExists, cascade } = {}) {
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  const cascadeStr = cascade ? " CASCADE" : "";
  return template`DROP TYPE${ifExistsStr} "${typeName}"${cascadeStr};`;
}

function createType(typeShorthands) {
  const _create = (typeName, options) => {
    if (_.isArray(options)) {
      const optionsStr = options.map(escapeValue).join(", ");
      return template`CREATE TYPE "${typeName}" AS ENUM (${optionsStr});`;
    }
    const attributes = _.map(options, (attribute, attributeName) => {
      const typeStr = applyType(attribute, typeShorthands).type;
      return template`"${attributeName}" ${typeStr}`;
    }).join(",\n");
    return template`CREATE TYPE "${typeName}" AS (\n${attributes}\n);`;
  };
  _create.reverse = dropType;
  return _create;
}

function dropTypeAttribute(typeName, attributeName, { ifExists } = {}) {
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  return template`ALTER TYPE "${typeName}" DROP ATTRIBUTE "${attributeName}"${ifExistsStr};`;
}

function addTypeAttribute(typeShorthands) {
  const _alterAttributeAdd = (typeName, attributeName, attributeType) => {
    const typeStr = applyType(attributeType, typeShorthands).type;

    return template`ALTER TYPE "${typeName}" ADD ATTRIBUTE "${attributeName}" ${typeStr};`;
  };
  _alterAttributeAdd.reverse = dropTypeAttribute;
  return _alterAttributeAdd;
}

function setTypeAttribute(typeShorthands) {
  return (typeName, attributeName, attributeType) => {
    const typeStr = applyType(attributeType, typeShorthands).type;

    return template`ALTER TYPE "${typeName}" ALTER ATTRIBUTE "${attributeName}" SET DATA TYPE ${typeStr};`;
  };
}

function addTypeValue(typeName, value, options = {}) {
  const { ifNotExists, before, after } = options;

  if (before && after) {
    throw new Error('"before" and "after" can\'t be specified together');
  }
  const beforeStr = before ? ` BEFORE ${before}` : "";
  const afterStr = after ? ` AFTER ${after}` : "";
  const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
  const valueStr = escapeValue(value);

  return template`ALTER TYPE "${typeName}" ADD VALUE${ifNotExistsStr} ${valueStr}${beforeStr}${afterStr};`;
}

function renameType(typeName, newTypeName) {
  return template`ALTER TYPE  "${typeName}" RENAME TO "${newTypeName}";`;
}

const undoRename = (typeName, newTypeName) => renameType(newTypeName, typeName);

function renameTypeAttribute(typeName, attributeName, newAttributeName) {
  return template`ALTER TYPE "${typeName}" RENAME ATTRIBUTE "${attributeName}" TO "${newAttributeName}";`;
}

const undoRenameTypeAttribute = (typeName, attributeName, newAttributeName) =>
  renameTypeAttribute(typeName, newAttributeName, attributeName);

function renameTypeValue(typeName, value, newValue) {
  const valueStr = escapeValue(value);
  const newValueStr = escapeValue(newValue);
  return template`ALTER TYPE "${typeName}" RENAME VALUE ${valueStr} TO ${newValueStr};`;
}

const undoRenameTypeValue = (typeName, value, newValue) =>
  renameTypeValue(typeName, newValue, value);

renameType.reverse = undoRename;
renameTypeAttribute.reverse = undoRenameTypeAttribute;
renameTypeValue.reverse = undoRenameTypeValue;

module.exports = {
  createType,
  dropType,
  renameType,
  addTypeAttribute,
  dropTypeAttribute,
  setTypeAttribute,
  renameTypeAttribute,
  renameTypeValue,
  addTypeValue
};
