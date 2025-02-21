import type { MigrationOptions } from '../../migrationOptions';
import { escapeValue, toArray } from '../../utils';
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
      deferrable = false,
      deferred = false,
      functionParams = [],
    } = triggerOptions;

    let { when, level = 'STATEMENT', function: functionName } = triggerOptions;

    const operations = toArray(operation).join(' OR ');
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

    if (!operations) {
      throw new Error(
        '"operation" (INSERT/UPDATE[ OF ...]/DELETE/TRUNCATE) have to be specified'
      );
    }

    const defferStr = constraint
      ? `${deferrable ? `DEFERRABLE INITIALLY ${deferred ? 'DEFERRED' : 'IMMEDIATE'}` : 'NOT DEFERRABLE'}\n  `
      : '';
    const conditionClause = condition ? `WHEN (${condition})\n  ` : '';
    const constraintStr = constraint ? ' CONSTRAINT' : '';
    const paramsStr = functionParams.map(escapeValue).join(', ');
    const triggerNameStr = mOptions.literal(triggerName);
    const tableNameStr = mOptions.literal(tableName);
    const functionNameStr = mOptions.literal(functionName);

    const triggerSQL = `CREATE${constraintStr} TRIGGER ${triggerNameStr}
  ${when} ${operations} ON ${tableNameStr}
  ${defferStr}FOR EACH ${level}
  ${conditionClause}EXECUTE PROCEDURE ${functionNameStr}(${paramsStr});`;

    const fnSQL = definition
      ? `${createFunction(mOptions)(
          functionName,
          [],
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
