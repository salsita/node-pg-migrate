import * as _ from 'lodash';
import {
  escapeValue,
  applyType,
  applyTypeAdapters,
  comment,
  formatLines
} from '../utils';
import { parseSequenceOptions } from './sequences';

const parseReferences = (options, literal) => {
  const { references, match, onDelete, onUpdate } = options;
  const clauses = [];
  clauses.push(
    typeof references === 'string' &&
      (references.startsWith('"') || references.endsWith(')'))
      ? `REFERENCES ${references}`
      : `REFERENCES ${literal(references)}`
  );
  if (match) {
    clauses.push(`MATCH ${match}`);
  }
  if (onDelete) {
    clauses.push(`ON DELETE ${onDelete}`);
  }
  if (onUpdate) {
    clauses.push(`ON UPDATE ${onUpdate}`);
  }
  return clauses.join(' ');
};

const parseDeferrable = options =>
  `DEFERRABLE INITIALLY ${options.deferred ? 'DEFERRED' : 'IMMEDIATE'}`;

const parseColumns = (tableName, columns, mOptions) => {
  const extendingTypeShorthands = mOptions.typeShorthands;
  let columnsWithOptions = _.mapValues(columns, column =>
    applyType(column, extendingTypeShorthands)
  );

  const primaryColumns = _.chain(columnsWithOptions)
    .map((options, columnName) => (options.primaryKey ? columnName : null))
    .filter()
    .value();
  const multiplePrimaryColumns = primaryColumns.length > 1;

  if (multiplePrimaryColumns) {
    columnsWithOptions = _.mapValues(columnsWithOptions, options => ({
      ...options,
      primaryKey: false
    }));
  }

  const comments = _.chain(columnsWithOptions)
    .map(
      (options, columnName) =>
        typeof options.comment !== 'undefined' &&
        comment(
          'COLUMN',
          `${mOptions.literal(tableName)}.${mOptions.literal(columnName)}`,
          options.comment
        )
    )
    .filter()
    .value();

  return {
    columns: _.map(columnsWithOptions, (options, columnName) => {
      const {
        type,
        collation,
        default: defaultValue,
        unique,
        primaryKey,
        notNull,
        check,
        references,
        referencesConstraintName,
        referencesConstraintComment,
        deferrable,
        generated
      } = options;
      const constraints = [];
      if (collation) {
        constraints.push(`COLLATE ${collation}`);
      }
      if (defaultValue !== undefined) {
        constraints.push(`DEFAULT ${escapeValue(defaultValue)}`);
      }
      if (unique) {
        constraints.push('UNIQUE');
      }
      if (primaryKey) {
        constraints.push('PRIMARY KEY');
      }
      if (notNull) {
        constraints.push('NOT NULL');
      }
      if (check) {
        constraints.push(`CHECK (${check})`);
      }
      if (references) {
        const name =
          referencesConstraintName ||
          (referencesConstraintComment ? `${tableName}_fk_${columnName}` : '');
        const constraintName = name
          ? `CONSTRAINT ${mOptions.literal(name)} `
          : '';
        constraints.push(
          `${constraintName}${parseReferences(options, mOptions.literal)}`
        );
        if (referencesConstraintComment) {
          comments.push(
            comment(
              `CONSTRAINT ${mOptions.literal(name)} ON`,
              mOptions.literal(tableName),
              referencesConstraintComment
            )
          );
        }
      }
      if (deferrable) {
        constraints.push(parseDeferrable(options));
      }
      if (generated) {
        const sequenceOptions = parseSequenceOptions(
          extendingTypeShorthands,
          generated
        ).join(' ');
        constraints.push(
          `GENERATED ${generated.precedence} AS IDENTITY${
            sequenceOptions ? ` (${sequenceOptions})` : ''
          }`
        );
      }

      const constraintsStr = constraints.length
        ? ` ${constraints.join(' ')}`
        : '';

      const sType = typeof type === 'object' ? mOptions.literal(type) : type;

      return `${mOptions.literal(columnName)} ${sType}${constraintsStr}`;
    }),
    constraints: multiplePrimaryColumns ? { primaryKey: primaryColumns } : {},
    comments
  };
};

const parseConstraints = (table, options, optionName, literal) => {
  const {
    check,
    unique,
    primaryKey,
    foreignKeys,
    exclude,
    deferrable,
    comment: optionComment
  } = options;
  const tableName = typeof table === 'object' ? table.name : table;
  let constraints = [];
  const comments = [];
  if (check) {
    if (_.isArray(check)) {
      check.forEach((ch, i) => {
        const name = literal(optionName || `${tableName}_chck_${i + 1}`);
        constraints.push(`CONSTRAINT ${name} CHECK (${ch})`);
      });
    } else {
      const name = literal(optionName || `${tableName}_chck`);
      constraints.push(`CONSTRAINT ${name} CHECK (${check})`);
    }
  }
  if (unique) {
    const uniqueArray = _.isArray(unique) ? unique : [unique];
    const isArrayOfArrays = uniqueArray.some(uniqueSet => _.isArray(uniqueSet));
    (isArrayOfArrays ? uniqueArray : [uniqueArray]).forEach(uniqueSet => {
      const cols = _.isArray(uniqueSet) ? uniqueSet : [uniqueSet];
      const name = literal(optionName || `${tableName}_uniq_${cols.join('_')}`);
      constraints.push(
        `CONSTRAINT ${name} UNIQUE (${cols.map(literal).join(', ')})`
      );
    });
  }
  if (primaryKey) {
    const name = literal(optionName || `${tableName}_pkey`);
    const key = (_.isArray(primaryKey) ? primaryKey : [primaryKey])
      .map(literal)
      .join(', ');
    constraints.push(`CONSTRAINT ${name} PRIMARY KEY (${key})`);
  }
  if (foreignKeys) {
    (_.isArray(foreignKeys) ? foreignKeys : [foreignKeys]).forEach(fk => {
      const {
        columns,
        referencesConstraintName,
        referencesConstraintComment
      } = fk;
      const cols = _.isArray(columns) ? columns : [columns];
      const name = literal(
        referencesConstraintName ||
          optionName ||
          `${tableName}_fk_${cols.join('_')}`
      );
      const key = cols.map(literal).join(', ');
      const referencesStr = parseReferences(fk, literal);
      constraints.push(
        `CONSTRAINT ${name} FOREIGN KEY (${key}) ${referencesStr}`
      );
      if (referencesConstraintComment) {
        comments.push(
          comment(
            `CONSTRAINT ${name} ON`,
            literal(tableName),
            referencesConstraintComment
          )
        );
      }
    });
  }
  if (exclude) {
    const name = literal(optionName || `${tableName}_excl`);
    constraints.push(`CONSTRAINT ${name} EXCLUDE ${exclude}`);
  }

  if (deferrable) {
    constraints = constraints.map(
      constraint => `${constraint} ${parseDeferrable(options)}`
    );
  }
  if (optionComment) {
    if (!optionName)
      throw new Error('cannot comment on unspecified constraints');
    comments.push(
      comment(
        `CONSTRAINT ${literal(optionName)} ON`,
        literal(tableName),
        optionComment
      )
    );
  }
  return {
    constraints,
    comments
  };
};

const parseLike = (like, literal) => {
  const formatOptions = (name, options) =>
    (_.isArray(options) ? options : [options])
      .map(option => ` ${name} ${option}`)
      .join('');

  const table = typeof like === 'string' || !like.table ? like : like.table;
  const options = like.options
    ? [
        formatOptions('INCLUDING', like.options.including),
        formatOptions('EXCLUDING', like.options.excluding)
      ].join('')
    : '';
  return `LIKE ${literal(table)}${options}`;
};

// TABLE
export function dropTable(mOptions) {
  const _drop = (tableName, { ifExists, cascade } = {}) => {
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const tableNameStr = mOptions.literal(tableName);
    return `DROP TABLE${ifExistsStr} ${tableNameStr}${cascadeStr};`;
  };
  return _drop;
}

export function createTable(mOptions) {
  const _create = (tableName, columns, options = {}) => {
    const {
      temporary,
      ifNotExists,
      inherits,
      like,
      constraints: optionsConstraints = {},
      comment: tableComment
    } = options;
    const {
      columns: columnLines,
      constraints: crossColumnConstraints,
      comments: columnComments = []
    } = parseColumns(tableName, columns, mOptions);
    const dupes = _.intersection(
      Object.keys(optionsConstraints),
      Object.keys(crossColumnConstraints)
    );
    if (dupes.length > 0) {
      const dupesStr = dupes.join(', ');
      throw new Error(
        `There is duplicate constraint definition in table and columns options: ${dupesStr}`
      );
    }

    const constraints = { ...optionsConstraints, ...crossColumnConstraints };
    const {
      constraints: constraintLines,
      comments: constraintComments
    } = parseConstraints(tableName, constraints, '', mOptions.literal);
    const tableDefinition = [...columnLines, ...constraintLines].concat(
      like ? [parseLike(like, mOptions.literal)] : []
    );

    const temporaryStr = temporary ? ' TEMPORARY' : '';
    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : '';
    const inheritsStr = inherits
      ? ` INHERITS (${mOptions.literal(inherits)})`
      : '';
    const tableNameStr = mOptions.literal(tableName);

    const createTableQuery = `CREATE TABLE${temporaryStr}${ifNotExistsStr} ${tableNameStr} (
${formatLines(tableDefinition)}
)${inheritsStr};`;
    const comments = [...columnComments, ...constraintComments];
    if (typeof tableComment !== 'undefined') {
      comments.push(
        comment('TABLE', mOptions.literal(tableName), tableComment)
      );
    }
    return `${createTableQuery}${
      comments.length > 0 ? `\n${comments.join('\n')}` : ''
    }`;
  };
  _create.reverse = dropTable(mOptions);
  return _create;
}

export function alterTable(mOptions) {
  const _alter = (tableName, options) => {
    const alterDefinition = [];
    if (options.levelSecurity) {
      alterDefinition.push(`${options.levelSecurity} ROW LEVEL SECURITY`);
    }
    return `ALTER TABLE ${mOptions.literal(tableName)}
  ${formatLines(alterDefinition)};`;
  };
  return _alter;
}

// COLUMNS
export function dropColumns(mOptions) {
  const _drop = (tableName, columns, { ifExists, cascade } = {}) => {
    if (typeof columns === 'string') {
      columns = [columns]; // eslint-disable-line no-param-reassign
    } else if (!_.isArray(columns) && typeof columns === 'object') {
      columns = _.keys(columns); // eslint-disable-line no-param-reassign
    }
    const columnsStr = formatLines(
      columns.map(mOptions.literal),
      `  DROP ${ifExists ? ' IF EXISTS' : ''}`,
      `${cascade ? ' CASCADE' : ''},`
    );
    return `ALTER TABLE ${mOptions.literal(tableName)}
${columnsStr};`;
  };
  return _drop;
}

export function addColumns(mOptions) {
  const _add = (tableName, columns, { ifNotExists } = {}) => {
    const {
      columns: columnLines,
      comments: columnComments = []
    } = parseColumns(tableName, columns, mOptions);
    const columnsStr = formatLines(
      columnLines,
      `  ADD ${ifNotExists ? 'IF NOT EXISTS ' : ''}`
    );
    const tableNameStr = mOptions.literal(tableName);
    const alterTableQuery = `ALTER TABLE ${tableNameStr}\n${columnsStr};`;
    const columnCommentsStr =
      columnComments.length > 0 ? `\n${columnComments.join('\n')}` : '';
    return `${alterTableQuery}${columnCommentsStr}`;
  };
  _add.reverse = dropColumns(mOptions);
  return _add;
}

export function alterColumn(mOptions) {
  return (tableName, columnName, options) => {
    const {
      default: defaultValue,
      type,
      collation,
      using,
      notNull,
      allowNull,
      comment: columnComment,
      generated
    } = options;
    const actions = [];
    if (defaultValue === null) {
      actions.push('DROP DEFAULT');
    } else if (defaultValue !== undefined) {
      actions.push(`SET DEFAULT ${escapeValue(defaultValue)}`);
    }
    if (type) {
      const typeStr = applyTypeAdapters(type);
      const collationStr = collation ? `COLLATE ${collation}` : '';
      const usingStr = using ? ` USING ${using}` : '';
      actions.push(`SET DATA TYPE ${typeStr}${collationStr}${usingStr}`);
    }
    if (notNull) {
      actions.push('SET NOT NULL');
    } else if (notNull === false || allowNull) {
      actions.push('DROP NOT NULL');
    }
    if (generated !== undefined) {
      if (!generated) {
        actions.push('DROP IDENTITY');
      } else {
        const sequenceOptions = parseSequenceOptions(
          mOptions.typeShorthands,
          generated
        ).join(' ');
        actions.push(
          `SET GENERATED ${generated.precedence} AS IDENTITY${
            sequenceOptions ? ` (${sequenceOptions})` : ''
          }`
        );
      }
    }

    const queries = [];
    if (actions.length > 0) {
      const columnsStr = formatLines(
        actions,
        `  ALTER ${mOptions.literal(columnName)} `
      );
      queries.push(
        `ALTER TABLE ${mOptions.literal(tableName)}\n${columnsStr};`
      );
    }
    if (typeof columnComment !== 'undefined') {
      queries.push(
        comment(
          'COLUMN',
          `${mOptions.literal(tableName)}.${mOptions.literal(columnName)}`,
          columnComment
        )
      );
    }
    return queries.join('\n');
  };
}

export function renameTable(mOptions) {
  const _rename = (tableName, newName) => {
    const tableNameStr = mOptions.literal(tableName);
    const newNameStr = mOptions.literal(newName);
    return `ALTER TABLE ${tableNameStr} RENAME TO ${newNameStr};`;
  };
  _rename.reverse = (tableName, newName) => _rename(newName, tableName);
  return _rename;
}

export function renameColumn(mOptions) {
  const _rename = (tableName, columnName, newName) => {
    const tableNameStr = mOptions.literal(tableName);
    const columnNameStr = mOptions.literal(columnName);
    const newNameStr = mOptions.literal(newName);
    return `ALTER TABLE ${tableNameStr} RENAME ${columnNameStr} TO ${newNameStr};`;
  };
  _rename.reverse = (tableName, columnName, newName) =>
    _rename(tableName, newName, columnName);
  return _rename;
}

export function renameConstraint(mOptions) {
  const _rename = (tableName, constraintName, newName) => {
    const tableNameStr = mOptions.literal(tableName);
    const constraintNameStr = mOptions.literal(constraintName);
    const newNameStr = mOptions.literal(newName);
    return `ALTER TABLE ${tableNameStr} RENAME CONSTRAINT ${constraintNameStr} TO ${newNameStr};`;
  };
  _rename.reverse = (tableName, constraintName, newName) =>
    _rename(tableName, newName, constraintName);
  return _rename;
}

export function dropConstraint(mOptions) {
  const _drop = (tableName, constraintName, { ifExists, cascade } = {}) => {
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const tableNameStr = mOptions.literal(tableName);
    const constraintNameStr = mOptions.literal(constraintName);
    return `ALTER TABLE ${tableNameStr} DROP CONSTRAINT${ifExistsStr} ${constraintNameStr}${cascadeStr};`;
  };
  return _drop;
}
export function addConstraint(mOptions) {
  const _add = (tableName, constraintName, expression) => {
    const { constraints, comments } =
      typeof expression === 'string'
        ? {
            constraints: [
              `${
                constraintName
                  ? `CONSTRAINT ${mOptions.literal(constraintName)} `
                  : ''
              }${expression}`
            ],
            comments: []
          }
        : parseConstraints(
            tableName,
            expression,
            constraintName,
            mOptions.literal
          );
    const constraintStr = formatLines(constraints, '  ADD ');
    return [
      `ALTER TABLE ${mOptions.literal(tableName)}\n${constraintStr};`,
      ...comments
    ].join('\n');
  };
  _add.reverse = dropConstraint(mOptions);
  return _add;
}
