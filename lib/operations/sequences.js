import { template, applyType } from '../utils';

const parseOptions = (type_shorthands, options) => {
  const {
    type,
    increment,
    minvalue,
    maxvalue,
    start,
    cache,
    cycle,
    owner,
  } = options;
  const clauses = [];
  if (type) {
    clauses.push(`AS ${applyType(type, type_shorthands).type}`);
  }
  if (increment) {
    clauses.push(`INCREMENT BY ${increment}`);
  }
  if (minvalue) {
    clauses.push(`MINVALUE ${minvalue}`);
  } else if (minvalue === null || minvalue === false) {
    clauses.push('NO MINVALUE');
  }
  if (maxvalue) {
    clauses.push(`MAXVALUE ${maxvalue}`);
  } else if (maxvalue === null || maxvalue === false) {
    clauses.push('NO MAXVALUE');
  }
  if (start) {
    clauses.push(`START WITH ${start}`);
  }
  if (cache) {
    clauses.push(`CACHE ${cache}`);
  }
  if (cycle) {
    clauses.push('CYCLE');
  } else if (cycle === false) {
    clauses.push('NO CYCLE');
  }
  if (owner) {
    clauses.push(`OWNED BY ${owner}`);
  } else if (owner === null || owner === false) {
    clauses.push('OWNED BY NONE');
  }
  return clauses;
};

export const drop = (sequence_name, { ifExists, cascade } = {}) =>
  template`DROP SEQUENCE${ifExists ? ' IF EXISTS' : ''} "${sequence_name}"${cascade ? ' CASCADE' : ''};`;

export const create = (type_shorthands) => {
  const _create = (sequence_name, options) => {
    const {
      temporary,
      ifNotExists,
    } = options;
    const clauses = parseOptions(type_shorthands, options);
    return template`CREATE${temporary ? ' TEMPORARY' : ''} SEQUENCE${ifNotExists ? ' IF NOT EXISTS' : ''} "${sequence_name}"
  ${clauses.join('\n  ')};`;
  };
  _create.reverse = drop;
  return _create;
};

export const alter = type_shorthands =>
  (sequence_name, options) => {
    const {
      restart,
    } = options;
    const clauses = parseOptions(type_shorthands, options);
    if (restart) {
      if (restart === true) {
        clauses.push('RESTART');
      } else {
        clauses.push(`RESTART WITH ${restart}`);
      }
    }
    return template`ALTER SEQUENCE "${sequence_name}"
  ${clauses.join('\n  ')};`;
  };

// RENAME
export const rename = (sequence_name, new_sequence_name) =>
  template`ALTER SEQUENCE "${sequence_name}" RENAME TO "${new_sequence_name}";`;

export const undoRename = (sequence_name, new_sequence_name) =>
  rename(new_sequence_name, sequence_name);

rename.reverse = undoRename;
