import { isArray } from 'lodash';
import { template } from '../utils';
import { create as createFunction, drop as dropFunction } from './functions';

export const drop = (table_name, trigger_name, { ifExists, cascade } = {}) =>
  template`DROP TRIGGER${ifExists ? ' IF EXISTS' : ''} "${trigger_name}" ON "${table_name}"${cascade ? ' CASCADE' : ''};`;

export const create = (type_shorthands) => {
  const _create = (table_name, trigger_name, trigger_options = {}, definition) => {
    const {
      constraint,
      condition,
      operation,
      deferrable,
      deferred,
    } = trigger_options;
    let {
      when,
      level = 'STATEMENT',
      function: functionName,
    } = trigger_options;
    const operations = isArray(operation) ? operation.join(' OR ') : operation;
    if (constraint) {
      when = 'AFTER';
    }
    const isInsteadOf = /instead\s+of/i.test(when);
    if (isInsteadOf) {
      level = 'ROW';
    }
    if (definition) {
      functionName = functionName || trigger_name;
    }

    if (!when) {
      throw new Error('"when" (BEFORE/AFTER/INSTEAD OF) have to be specified');
    } else if (isInsteadOf && condition) {
      throw new Error('INSTEAD OF trigger can\'t have condition specified');
    }
    if (!operations) {
      throw new Error('"operation" (INSERT/UPDATE[ OF ...]/DELETE/TRUNCATE) have to be specified');
    }

    const defferClause = constraint
      ? `${deferrable ? `DEFERRABLE INITIALLY ${deferred ? 'DEFERRED' : 'IMMEDIATE'}` : 'NOT DEFERRABLE'}\n  `
      : '';
    const conditionClause = condition
      ? `WHEN (${condition})\n  `
      : '';

    const triggerSQL = template`CREATE${constraint ? ' CONSTRAINT' : ''} TRIGGER "${trigger_name}"
  ${when} ${operations} ON "${table_name}"
  ${defferClause}FOR EACH ${level}
  ${conditionClause}EXECUTE PROCEDURE "${functionName}"();`;

    return `${definition
      ? `${createFunction(type_shorthands)(functionName, [], { ...trigger_options, returns: 'trigger' }, definition)}\n`
      : ''}${triggerSQL}`;
  };

  _create.reverse = (table_name, trigger_name, trigger_options = {}, definition) =>
    `${drop(table_name, trigger_name, trigger_options)}${
      definition
        ? `\n${dropFunction(type_shorthands)(trigger_options.function || trigger_name, [], trigger_options)}`
        : ''
    }`;

  return _create;
};

export const rename = (table_name, old_trigger_name, new_trigger_name) =>
  template`ALTER TRIGGER "${old_trigger_name}" ON "${table_name}" RENAME TO "${new_trigger_name}";`;

export const undoRename = (table_name, old_trigger_name, new_trigger_name) =>
  rename(table_name, new_trigger_name, old_trigger_name);

rename.reverse = undoRename;
