import { template, applyType } from '../utils';

const parseOptions = (typeShorthands, options) => {
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
    clauses.push(`AS ${applyType(type, typeShorthands).type}`);
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

export const drop = (sequenceName, { ifExists, cascade } = {}) =>
  template`DROP SEQUENCE${ifExists ? ' IF EXISTS' : ''} "${sequenceName}"${cascade ? ' CASCADE' : ''};`;

export const create = (typeShorthands) => {
  const _create = (sequenceName, options) => {
    const {
      temporary,
      ifNotExists,
    } = options;
    const clauses = parseOptions(typeShorthands, options);
    return template`CREATE${temporary ? ' TEMPORARY' : ''} SEQUENCE${ifNotExists ? ' IF NOT EXISTS' : ''} "${sequenceName}"
  ${clauses.join('\n  ')};`;
  };
  _create.reverse = drop;
  return _create;
};

export const alter = typeShorthands =>
  (sequenceName, options) => {
    const {
      restart,
    } = options;
    const clauses = parseOptions(typeShorthands, options);
    if (restart) {
      if (restart === true) {
        clauses.push('RESTART');
      } else {
        clauses.push(`RESTART WITH ${restart}`);
      }
    }
    return template`ALTER SEQUENCE "${sequenceName}"
  ${clauses.join('\n  ')};`;
  };

// RENAME
export const rename = (sequenceName, newSequenceName) =>
  template`ALTER SEQUENCE "${sequenceName}" RENAME TO "${newSequenceName}";`;

export const undoRename = (sequenceName, newSequenceName) =>
  rename(newSequenceName, sequenceName);

rename.reverse = undoRename;
