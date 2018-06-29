const { isArray } = require("lodash");
const { escapeValue, template } = require("../utils");
const { createFunction, dropFunction } = require("./functions");

function dropTrigger(tableName, triggerName, { ifExists, cascade } = {}) {
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  const cascadeStr = cascade ? " CASCADE" : "";
  return template`DROP TRIGGER${ifExistsStr} "${triggerName}" ON "${tableName}"${cascadeStr};`;
}

function createTrigger(typeShorthands) {
  const _create = (tableName, triggerName, triggerOptions = {}, definition) => {
    const {
      constraint,
      condition,
      operation,
      deferrable,
      deferred,
      functionArgs = []
    } = triggerOptions;
    let { when, level = "STATEMENT", function: functionName } = triggerOptions;
    const operations = isArray(operation) ? operation.join(" OR ") : operation;
    if (constraint) {
      when = "AFTER";
    }
    const isInsteadOf = /instead\s+of/i.test(when);
    if (isInsteadOf) {
      level = "ROW";
    }
    if (definition) {
      functionName = functionName || triggerName;
    }

    if (!when) {
      throw new Error('"when" (BEFORE/AFTER/INSTEAD OF) have to be specified');
    } else if (isInsteadOf && condition) {
      throw new Error("INSTEAD OF trigger can't have condition specified");
    }
    if (!operations) {
      throw new Error(
        '"operation" (INSERT/UPDATE[ OF ...]/DELETE/TRUNCATE) have to be specified'
      );
    }

    const defferStr = constraint
      ? `${
          deferrable
            ? `DEFERRABLE INITIALLY ${deferred ? "DEFERRED" : "IMMEDIATE"}`
            : "NOT DEFERRABLE"
        }\n  `
      : "";
    const conditionClause = condition ? `WHEN (${condition})\n  ` : "";
    const constraintStr = constraint ? " CONSTRAINT" : "";
    const paramsStr = functionArgs.map(escapeValue).join(", ");

    const triggerSQL = template`CREATE${constraintStr} TRIGGER "${triggerName}"
  ${when} ${operations} ON "${tableName}"
  ${defferStr}FOR EACH ${level}
  ${conditionClause}EXECUTE PROCEDURE "${functionName}"(${paramsStr});`;

    const fnSQL = definition
      ? `${createFunction(typeShorthands)(
          functionName,
          [],
          { ...triggerOptions, returns: "trigger" },
          definition
        )}\n`
      : "";
    return `${fnSQL}${triggerSQL}`;
  };

  _create.reverse = (
    tableName,
    triggerName,
    triggerOptions = {},
    definition
  ) => {
    const triggerSQL = dropTrigger(tableName, triggerName, triggerOptions);
    const fnSQL = definition
      ? `\n${dropFunction(typeShorthands)(
          triggerOptions.function || triggerName,
          [],
          triggerOptions
        )}`
      : "";
    return `${triggerSQL}${fnSQL}`;
  };

  return _create;
}

function renameTrigger(tableName, oldTriggerName, newTriggerName) {
  return template`ALTER TRIGGER "${oldTriggerName}" ON "${tableName}" RENAME TO "${newTriggerName}";`;
}

const undoRename = (tableName, oldTriggerName, newTriggerName) =>
  renameTrigger(tableName, newTriggerName, oldTriggerName);

renameTrigger.reverse = undoRename;

module.exports = {
  createTrigger,
  dropTrigger,
  renameTrigger
};
