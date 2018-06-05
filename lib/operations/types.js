import _ from "lodash";
import { template, applyType, escapeValue } from "../utils";

export const dropType = (typeName, { ifExists, cascade } = {}) => {
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  const cascadeStr = cascade ? " CASCADE" : "";
  return template`DROP TYPE${ifExistsStr} "${typeName}"${cascadeStr};`;
};

export const createType = typeShorthands => {
  const _create = (typeName, options) => {
    if (_.isArray(options)) {
      const optionsStr = options.map(escapeValue).join(", ");
      return template`CREATE TYPE "${typeName}" AS ENUM (${optionsStr});`;
    }
    const attributes = _
      .map(options, (attribute, attributeName) => {
        const typeStr = applyType(attribute, typeShorthands).type;
        return template`"${attributeName}" ${typeStr}`;
      })
      .join(",\n");
    return template`CREATE TYPE "${typeName}" AS (\n${attributes}\n);`;
  };
  _create.reverse = dropType;
  return _create;
};

export const dropTypeAttribute = (
  typeName,
  attributeName,
  { ifExists } = {}
) => {
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  return template`ALTER TYPE "${typeName}" DROP ATTRIBUTE "${attributeName}"${ifExistsStr};`;
};

export const addTypeAttribute = typeShorthands => {
  const _alterAttributeAdd = (typeName, attributeName, attributeType) => {
    const typeStr = applyType(attributeType, typeShorthands).type;

    return template`ALTER TYPE "${typeName}" ADD ATTRIBUTE "${attributeName}" ${typeStr};`;
  };
  _alterAttributeAdd.reverse = dropTypeAttribute;
  return _alterAttributeAdd;
};

export const setTypeAttribute = typeShorthands => (
  typeName,
  attributeName,
  attributeType
) => {
  const typeStr = applyType(attributeType, typeShorthands).type;

  return template`ALTER TYPE "${typeName}" ALTER ATTRIBUTE "${attributeName}" SET DATA TYPE ${typeStr};`;
};
export const addTypeValue = (typeName, value, options = {}) => {
  const { ifNotExists, before, after } = options;

  if (before && after) {
    throw new Error('"before" and "after" can\'t be specified together');
  }
  const beforeStr = before ? ` BEFORE ${before}` : "";
  const afterStr = after ? ` AFTER ${after}` : "";
  const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
  const valueStr = escapeValue(value);

  return template`ALTER TYPE "${typeName}" ADD VALUE${ifNotExistsStr} ${valueStr}${beforeStr}${afterStr};`;
};

export const renameType = (typeName, newTypeName) =>
  template`ALTER TYPE  "${typeName}" RENAME TO "${newTypeName}";`;

const undoRename = (typeName, newTypeName) => renameType(newTypeName, typeName);

export const renameTypeAttribute = (
  typeName,
  attributeName,
  newAttributeName
) =>
  template`ALTER TYPE "${typeName}" RENAME ATTRIBUTE "${attributeName}" TO "${newAttributeName}";`;

export const undoRenameTypeAttribute = (
  typeName,
  attributeName,
  newAttributeName
) => renameTypeAttribute(typeName, newAttributeName, attributeName);

renameType.reverse = undoRename;
renameTypeAttribute.reverse = undoRenameTypeAttribute;
