import { isArray } from 'lodash';
import { template } from '../utils';

export const drop = (table_name, trigger_name, { ifExists, cascade } = {}) =>
  template`DROP TRIGGER${ifExists ? ' IF EXISTS' : ''} "${trigger_name}" ON "${table_name}"${cascade ? ' CASCADE' : ''};`;

export const create = (table_name, trigger_name, trigger_options = {}) => {
  const {
    constraint,
    condition,
    operation,
    procedure,
    deferrable,
    deferred,
  } = trigger_options;
  let {
    when,
    level = 'STATEMENT',
  } = trigger_options;
  const operations = isArray(operation) ? operation.join(' OR ') : operation;
  if (constraint) {
    when = 'AFTER';
  }
  const isInsteadOf = /instead\s+of/i.test(when);
  if (isInsteadOf) {
    level = 'ROW';
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

  return template`CREATE${constraint ? ' CONSTRAINT' : ''} TRIGGER "${trigger_name}"
  ${when} ${operations} ON "${table_name}"
  ${defferClause}FOR EACH ${level}
  ${conditionClause}EXECUTE PROCEDURE "${procedure}"();`;
};

export const rename = (table_name, old_trigger_name, new_trigger_name) =>
  template`ALTER TRIGGER "${old_trigger_name}" ON "${table_name}" RENAME TO "${new_trigger_name}";`;

export const undoRename = (table_name, old_trigger_name, new_trigger_name) =>
  rename(table_name, new_trigger_name, old_trigger_name);

rename.reverse = undoRename;
create.reverse = drop;
