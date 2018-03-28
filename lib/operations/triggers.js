import { isArray } from "lodash";
import { escapeValue, template } from "../utils";
import { createFunction, dropFunction } from "./functions";

export const dropTrigger = (
  tableName,
  triggerName,
  { ifExists, cascade } = {}
) =>
  template`DROP TRIGGER${
    ifExists ? " IF EXISTS" : ""
  } "${triggerName}" ON "${tableName}"${cascade ? " CASCADE" : ""};`;

export const createTrigger = typeShorthands => {
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

    const defferClause = constraint
      ? `${
          deferrable
            ? `DEFERRABLE INITIALLY ${deferred ? "DEFERRED" : "IMMEDIATE"}`
            : "NOT DEFERRABLE"
        }\n  `
      : "";
    const conditionClause = condition ? `WHEN (${condition})\n  ` : "";

    const triggerSQL = template`CREATE${
      constraint ? " CONSTRAINT" : ""
    } TRIGGER "${triggerName}"
  ${when} ${operations} ON "${tableName}"
  ${defferClause}FOR EACH ${level}
  ${conditionClause}EXECUTE PROCEDURE "${functionName}"(${functionArgs
      .map(escapeValue)
      .join(", ")});`;

    return `${
      definition
        ? `${createFunction(typeShorthands)(
            functionName,
            [],
            { ...triggerOptions, returns: "trigger" },
            definition
          )}\n`
        : ""
    }${triggerSQL}`;
  };

  _create.reverse = (tableName, triggerName, triggerOptions = {}, definition) =>
    `${dropTrigger(tableName, triggerName, triggerOptions)}${
      definition
        ? `\n${dropFunction(typeShorthands)(
            triggerOptions.function || triggerName,
            [],
            triggerOptions
          )}`
        : ""
    }`;

  return _create;
};

export const renameTrigger = (tableName, oldTriggerName, newTriggerName) =>
  template`ALTER TRIGGER "${oldTriggerName}" ON "${tableName}" RENAME TO "${newTriggerName}";`;

const undoRename = (tableName, oldTriggerName, newTriggerName) =>
  renameTrigger(tableName, newTriggerName, oldTriggerName);

renameTrigger.reverse = undoRename;
