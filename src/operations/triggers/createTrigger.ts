import type { MigrationOptions } from '../../migrationOptions';
import { escapeValue, formatSeparator, toArray } from '../../utils';
import type { FunctionOptions } from '../functions';
import { createFunction, dropFunction } from '../functions';
import type { DropOptions, Name, Reversible, Value } from '../generalTypes';
import type { DropTriggerOptions } from './dropTrigger';
import { dropTrigger } from './dropTrigger';
import type { TriggerOptions } from './shared';

export type CreateTriggerFn1 = (
  tableName: Name,
  triggerName: string,
  triggerOptions: TriggerOptions & DropTriggerOptions
) => string;

export type CreateTriggerFn2 = (
  tableName: Name,
  triggerName: string,
  triggerOptions: TriggerOptions & FunctionOptions & DropTriggerOptions,
  definition: Value
) => string;

export type CreateTriggerFn = CreateTriggerFn1 | CreateTriggerFn2;

export type CreateTrigger = Reversible<CreateTriggerFn>;

export function createTrigger(mOptions: MigrationOptions): CreateTrigger {
  const _create: CreateTrigger = (
    tableName: Name,
    triggerName: string,
    triggerOptions:
      | (TriggerOptions & DropOptions)
      | (TriggerOptions & FunctionOptions & DropOptions),
    definition?: Value
  ) => {
    const {
      constraint = false,
      condition,
      operation,
      updateOf = [],
      deferrable = false,
      deferred = false,
      functionParams = [],
    } = triggerOptions;

    let { when, level = 'STATEMENT', function: functionName } = triggerOptions;

    const operationList = toArray(operation);
    if (constraint) {
      when = 'AFTER';
    }

    if (!when) {
      throw new Error('"when" (BEFORE/AFTER/INSTEAD OF) have to be specified');
    }

    const isInsteadOf = /instead\s+of/i.test(when);
    if (isInsteadOf) {
      level = 'ROW';
    }

    if (definition) {
      functionName = functionName === undefined ? triggerName : functionName;
    }

    if (!functionName) {
      throw new Error("Can't determine function name");
    }

    if (isInsteadOf && condition) {
      throw new Error("INSTEAD OF trigger can't have condition specified");
    }

    if (
      operationList.length === 0 ||
      (operationList.length === 1 &&
        (operationList[0] === '' || operationList[0] == null))
    ) {
      throw new Error(
        '"operation" (INSERT/UPDATE[ OF ...]/DELETE/TRUNCATE) have to be specified'
      );
    }

    const columns = toArray(updateOf);
    let renderedOperations = operationList;
    if (columns.length > 0) {
      if (isInsteadOf) {
        throw new Error('INSTEAD OF trigger cannot have "updateOf" specified');
      }
      if (columns.some((column) => column === '')) {
        throw new Error('"updateOf" column names must not be empty');
      }

      const normalizedOperations = operationList.map((event) =>
        event.trim().toUpperCase()
      );
      if (normalizedOperations.some((event) => /^UPDATE\s+OF\b/.test(event))) {
        throw new Error(
          '"updateOf" cannot be combined with UPDATE OF in "operation"'
        );
      }
      if (!normalizedOperations.includes('UPDATE')) {
        throw new Error(
          '"updateOf" requires a standalone UPDATE event in "operation"; pass multiple events as an array'
        );
      }

      const columnList = columns.map(mOptions.literal).join(', ');
      renderedOperations = operationList.map((event, index) =>
        normalizedOperations[index] === 'UPDATE'
          ? `UPDATE OF ${columnList}`
          : event
      );
    }
    const operations = renderedOperations.join(' OR ');

    const nl = formatSeparator(mOptions.pretty, '  ');
    const defferStr = constraint
      ? `${deferrable ? `DEFERRABLE INITIALLY ${deferred ? 'DEFERRED' : 'IMMEDIATE'}` : 'NOT DEFERRABLE'}${nl}`
      : '';
    const conditionClause = condition ? `WHEN (${condition})${nl}` : '';
    const constraintStr = constraint ? ' CONSTRAINT' : '';
    const paramsStr = functionParams.map(escapeValue).join(', ');
    const triggerNameStr = mOptions.literal(triggerName);
    const tableNameStr = mOptions.literal(tableName);
    const functionNameStr = mOptions.literal(functionName);

    const triggerSQL = `CREATE${constraintStr} TRIGGER ${triggerNameStr}${nl}${when} ${operations} ON ${tableNameStr}${nl}${defferStr}FOR EACH ${level}${nl}${conditionClause}EXECUTE PROCEDURE ${functionNameStr}(${paramsStr});`;

    const fnSQL = definition
      ? `${createFunction(mOptions)(
          functionName,
          [],
          // Passing a `definition` selects the `CreateTriggerFn2` overload,
          // which is the one that also carries the function options.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          { ...(triggerOptions as FunctionOptions), returns: 'trigger' },
          definition
        )}\n`
      : '';

    return `${fnSQL}${triggerSQL}`;
  };

  _create.reverse = (tableName, triggerName, triggerOptions, definition) => {
    const triggerSQL = dropTrigger(mOptions)(
      tableName,
      triggerName,
      triggerOptions
    );
    const fnSQL = definition
      ? `\n${dropFunction(mOptions)(triggerOptions.function || triggerName, [], triggerOptions)}`
      : '';

    return `${triggerSQL}${fnSQL}`;
  };

  return _create;
}
