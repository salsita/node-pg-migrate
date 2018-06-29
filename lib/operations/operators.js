const {
  opSchemalize,
  schemalize,
  formatParams,
  applyType
} = require("../utils");

const createOperator = (operatorName, options = {}) => {
  const {
    procedure,
    left,
    right,
    commutator,
    negator,
    restrict,
    join,
    hashes,
    merges
  } = options;

  const defs = [];
  defs.push(`PROCEDURE = ${schemalize(procedure)}`);
  if (left) {
    defs.push(`LEFTARG = ${schemalize(left)}`);
  }
  if (right) {
    defs.push(`RIGHTARG = ${schemalize(right)}`);
  }
  if (commutator) {
    defs.push(`COMMUTATOR = ${opSchemalize(commutator)}`);
  }
  if (negator) {
    defs.push(`NEGATOR = ${opSchemalize(negator)}`);
  }
  if (restrict) {
    defs.push(`RESTRICT = ${schemalize(restrict)}`);
  }
  if (join) {
    defs.push(`JOIN = ${schemalize(join)}`);
  }
  if (hashes) {
    defs.push("HASHES");
  }
  if (merges) {
    defs.push("MERGES");
  }
  return `CREATE OPERATOR ${opSchemalize(operatorName)} (${defs.join(", ")});`;
};

const dropOperator = (operatorName, options = {}) => {
  const { ifExists, cascade, left, right } = options;

  const operatorNameStr = schemalize(operatorName);
  const leftStr = schemalize(left || "none");
  const rightStr = schemalize(right || "none");

  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  const cascadeStr = cascade ? " CASCADE" : "";

  return `DROP OPERATOR${ifExistsStr} ${operatorNameStr}(${leftStr}, ${rightStr})${cascadeStr};`;
};

function createOperatorFamily(operatorFamilyName, indexMethod) {
  const operatorFamilyNameStr = schemalize(operatorFamilyName);
  return `CREATE OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod};`;
}

function dropOperatorFamily(
  operatorFamilyName,
  indexMethod,
  { ifExists, cascade } = {}
) {
  const operatorFamilyNameStr = schemalize(operatorFamilyName);
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  const cascadeStr = cascade ? " CASCADE" : "";
  return `DROP OPERATOR FAMILY ${ifExistsStr} ${operatorFamilyNameStr} USING ${indexMethod}${cascadeStr};`;
}

const operatorMap = typeShorthands => ({
  type = "",
  number,
  name,
  params = []
}) => {
  if (String(type).toLowerCase() === "function") {
    if (params.length > 2) {
      throw new Error("Operator can't have more than 2 parameters");
    }
    const nameStr = schemalize(name);
    const paramsStr =
      params.length > 0 ? formatParams(params, typeShorthands) : "";

    return `OPERATOR ${number} ${nameStr}${paramsStr}`;
  }

  if (String(type).toLowerCase() === "operator") {
    const paramsStr = formatParams(params, typeShorthands);
    return `FUNCTION ${number} ${schemalize(name)}${paramsStr}`;
  }

  throw new Error('Operator "type" must be either "function" or "operator"');
};

const changeOperatorFamily = (op, reverse) => typeShorthands => {
  const method = (operatorFamilyName, indexMethod, operatorList) => {
    const operatorFamilyNameStr = schemalize(operatorFamilyName);
    const operatorListStr = operatorList
      .map(operatorMap(typeShorthands))
      .join(",\n  ");

    return `ALTER OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod} ${op}
  ${operatorListStr};`;
  };
  if (reverse) {
    method.reverse = reverse(typeShorthands);
  }
  return method;
};

const removeFromOperatorFamily = changeOperatorFamily("DROP");
const addToOperatorFamily = changeOperatorFamily(
  "ADD",
  removeFromOperatorFamily
);

function renameOperatorFamily(
  oldOperatorFamilyName,
  indexMethod,
  newOperatorFamilyName
) {
  const oldOperatorFamilyNameStr = schemalize(oldOperatorFamilyName);
  const newOperatorFamilyNameStr = schemalize(newOperatorFamilyName);

  return `ALTER OPERATOR FAMILY ${oldOperatorFamilyNameStr} USING ${indexMethod} RENAME TO ${newOperatorFamilyNameStr};`;
}

const undoRenameOperatorFamily = (
  oldOperatorFamilyName,
  indexMethod,
  newOperatorFamilyName
) =>
  renameOperatorFamily(
    newOperatorFamilyName,
    indexMethod,
    oldOperatorFamilyName
  );

function dropOperatorClass(
  operatorClassName,
  indexMethod,
  { ifExists, cascade } = {}
) {
  const operatorClassNameStr = schemalize(operatorClassName);
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  const cascadeStr = cascade ? " CASCADE" : "";

  return `DROP OPERATOR CLASS ${ifExistsStr} ${operatorClassNameStr} USING ${indexMethod}${cascadeStr};`;
}

function createOperatorClass(typeShorthands) {
  const _create = (
    operatorClassName,
    type,
    indexMethod,
    operatorList,
    options
  ) => {
    const { default: isDefault, family } = options;
    const operatorClassNameStr = schemalize(operatorClassName);
    const defaultStr = isDefault ? " DEFAULT" : "";
    const typeStr = schemalize(applyType(type).type);
    const indexMethodStr = schemalize(indexMethod);
    const familyStr = family ? ` FAMILY ${family}` : "";
    const operatorListStr = operatorList
      .map(operatorMap(typeShorthands))
      .join(",\n  ");

    return `CREATE OPERATOR CLASS ${operatorClassNameStr}${defaultStr} FOR TYPE ${typeStr} USING ${indexMethodStr} ${familyStr} AS
  ${operatorListStr};`;
  };
  _create.reverse = (
    operatorClassName,
    type,
    indexMethod,
    operatorList,
    options
  ) => dropOperatorClass(operatorClassName, indexMethod, options);
  return _create;
}

function renameOperatorClass(
  oldOperatorClassName,
  indexMethod,
  newOperatorClassName
) {
  const oldOperatorClassNameStr = schemalize(oldOperatorClassName);
  const newOperatorClassNameStr = schemalize(newOperatorClassName);

  return `ALTER OPERATOR CLASS ${oldOperatorClassNameStr} USING ${indexMethod} RENAME TO ${newOperatorClassNameStr};`;
}

const undoRenameOperatorClass = (
  oldOperatorClassName,
  indexMethod,
  newOperatorClassName
) =>
  renameOperatorClass(newOperatorClassName, indexMethod, oldOperatorClassName);

// setup reverse functions
createOperator.reverse = dropOperator;
createOperatorFamily.reverse = dropOperatorFamily;
renameOperatorFamily.reverse = undoRenameOperatorFamily;
renameOperatorClass.reverse = undoRenameOperatorClass;

module.exports = {
  createOperator,
  dropOperator,
  createOperatorFamily,
  dropOperatorFamily,
  removeFromOperatorFamily,
  addToOperatorFamily,
  renameOperatorFamily,
  dropOperatorClass,
  createOperatorClass,
  renameOperatorClass
};
