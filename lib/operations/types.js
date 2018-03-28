import _ from "lodash";
import { template, applyType, escapeValue } from "../utils";

export const dropType = (typeName, { ifExists, cascade } = {}) =>
  template`DROP TYPE${ifExists ? " IF EXISTS" : ""} "${typeName}"${
    cascade ? " CASCADE" : ""
  };`;

export const createType = typeShorthands => {
  const _create = (typeName, options) => {
    if (_.isArray(options)) {
      return template`CREATE TYPE "${typeName}" AS ENUM (${options
        .map(escapeValue)
        .join(", ")});`;
    }
    const attributes = _.map(
      options,
      (attribute, attributeName) =>
        template`"${attributeName}" ${
          applyType(attribute, typeShorthands).type
        }`
    ).join(",\n");
    return template`CREATE TYPE "${typeName}" AS (\n${attributes}\n);`;
  };
  _create.reverse = dropType;
  return _create;
};

export const dropTypeAttribute = (typeName, attributeName, { ifExists } = {}) =>
  template`ALTER TYPE "${typeName}" DROP ATTRIBUTE "${attributeName}"${
    ifExists ? " IF EXISTS" : ""
  };`;

export const addTypeAttribute = typeShorthands => {
  const _alterAttributeAdd = (typeName, attributeName, attributeType) =>
    template`ALTER TYPE "${typeName}" ADD ATTRIBUTE "${attributeName}" ${
      applyType(attributeType, typeShorthands).type
    };`;
  _alterAttributeAdd.reverse = dropTypeAttribute;
  return _alterAttributeAdd;
};

export const setTypeAttribute = typeShorthands => (
  typeName,
  attributeName,
  attributeType
) =>
  template`ALTER TYPE "${typeName}" ALTER ATTRIBUTE "${attributeName}" SET DATA TYPE ${
    applyType(attributeType, typeShorthands).type
  };`;

export const addTypeValue = (typeName, value, options = {}) => {
  const { ifNotExists, before, after } = options;

  if (before && after) {
    throw new Error('"before" and "after" can\'t be specified together');
  }
  const beforeClause = before ? ` BEFORE ${before}` : "";
  const afterClause = after ? ` AFTER ${after}` : "";

  return template`ALTER TYPE "${typeName}" ADD VALUE${
    ifNotExists ? " IF NOT EXISTS" : ""
  } ${escapeValue(value)}${beforeClause}${afterClause};`;
};

// RENAME
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
