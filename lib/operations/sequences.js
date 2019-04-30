const { template, applyType } = require("../utils");

const parseSequenceOptions = (typeShorthands, options) => {
  const {
    type,
    increment,
    minvalue,
    maxvalue,
    start,
    cache,
    cycle,
    owner
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
    clauses.push("NO MINVALUE");
  }
  if (maxvalue) {
    clauses.push(`MAXVALUE ${maxvalue}`);
  } else if (maxvalue === null || maxvalue === false) {
    clauses.push("NO MAXVALUE");
  }
  if (start) {
    clauses.push(`START WITH ${start}`);
  }
  if (cache) {
    clauses.push(`CACHE ${cache}`);
  }
  if (cycle) {
    clauses.push("CYCLE");
  } else if (cycle === false) {
    clauses.push("NO CYCLE");
  }
  if (owner) {
    clauses.push(`OWNED BY ${owner}`);
  } else if (owner === null || owner === false) {
    clauses.push("OWNED BY NONE");
  }
  return clauses;
};

function dropSequence(sequenceName, { ifExists, cascade } = {}) {
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  const cascadeStr = cascade ? " CASCADE" : "";
  return template`DROP SEQUENCE${ifExistsStr} "${sequenceName}"${cascadeStr};`;
}

function createSequence(typeShorthands) {
  const _create = (sequenceName, options = {}) => {
    const { temporary, ifNotExists } = options;
    const temporaryStr = temporary ? " TEMPORARY" : "";
    const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
    const clausesStr = parseSequenceOptions(typeShorthands, options).join(
      "\n  "
    );
    return template`CREATE${temporaryStr} SEQUENCE${ifNotExistsStr} "${sequenceName}"
  ${clausesStr};`;
  };
  _create.reverse = dropSequence;
  return _create;
}

function alterSequence(typeShorthands) {
  return (sequenceName, options) => {
    const { restart } = options;
    const clauses = parseSequenceOptions(typeShorthands, options);
    if (restart) {
      if (restart === true) {
        clauses.push("RESTART");
      } else {
        clauses.push(`RESTART WITH ${restart}`);
      }
    }
    return template`ALTER SEQUENCE "${sequenceName}"
  ${clauses.join("\n  ")};`;
  };
}

function renameSequence(sequenceName, newSequenceName) {
  return template`ALTER SEQUENCE "${sequenceName}" RENAME TO "${newSequenceName}";`;
}

const undoRename = (sequenceName, newSequenceName) =>
  renameSequence(newSequenceName, sequenceName);

renameSequence.reverse = undoRename;

module.exports = {
  createSequence,
  dropSequence,
  alterSequence,
  renameSequence,
  parseSequenceOptions
};
