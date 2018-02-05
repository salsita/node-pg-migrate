import _ from 'lodash';
import { escapeValue, template, quote, applyType, applyTypeAdapters } from '../utils';

const formatLines = (lines, replace, separator = ',\n') =>
  lines.join(separator).replace(/^/gm, replace);

const parseReferences = (options) => {
  const {
    references,
    match,
    onDelete,
    onUpdate,
  } = options;
  const clauses = [
    typeof references === 'string'
      ? `REFERENCES ${references}`
      : template`REFERENCES "${references}"`,
  ];
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

const parseDeferrable = (options) => {
  const {
    deferrable,
    deferred,
  } = options;
  return deferrable
    ? `DEFERRABLE INITIALLY ${deferred ? 'DEFERRED' : 'IMMEDIATE'}`
    : null;
};

const parseColumns = (columns, extendingTypeShorthands = {}) => {
  let columnsWithOptions = _.mapValues(
    columns,
    column => applyType(column, extendingTypeShorthands)
  );

  const primaryColumns = _.chain(columnsWithOptions)
    .map((options, columnName) => (options.primaryKey ? columnName : null))
    .filter()
    .value();
  const multiplePrimaryColumns = primaryColumns.length > 1;

  if (multiplePrimaryColumns) {
    columnsWithOptions = _.mapValues(
      columnsWithOptions,
      options => ({ ...options, primaryKey: false })
    );
  }

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
        deferrable,
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
        constraints.push(parseReferences(options));
      }
      if (deferrable) {
        constraints.push(parseDeferrable(options));
      }

      const constraintsString = constraints.length ? ` ${constraints.join(' ')}` : '';

      return template`"${columnName}" ${type}${constraintsString}`;
    }),
    constraints: {
      ...(multiplePrimaryColumns ? { primaryKey: primaryColumns } : {}),
    },
  };
};

const parseConstraints = (table, options) => {
  const {
    check,
    unique,
    primaryKey,
    foreignKeys,
    exclude,
    deferrable,
  } = options;
  const tableName = typeof table === 'object' ? table.name : table;
  const constraints = [];
  if (check) {
    constraints.push(`CONSTRAINT "${tableName}_chck" CHECK (${check})`);
  }
  if (unique) {
    const uniqueArray = _.isArray(unique) ? unique : [unique];
    const isArrayOfArrays = uniqueArray.some(uniqueSet => _.isArray(uniqueSet));
    if (isArrayOfArrays) {
      uniqueArray.forEach((uniqueSet, i) =>
        constraints.push(`CONSTRAINT "${tableName}_uniq_${i + 1}" UNIQUE (${quote(_.isArray(uniqueSet) ? uniqueSet : [uniqueSet]).join(', ')})`)
      );
    } else {
      constraints.push(`CONSTRAINT "${tableName}_uniq" UNIQUE (${quote(uniqueArray).join(', ')})`);
    }
  }
  if (primaryKey) {
    constraints.push(`CONSTRAINT "${tableName}_pkey" PRIMARY KEY (${quote(_.isArray(primaryKey) ? primaryKey : [primaryKey]).join(', ')})`);
  }
  if (foreignKeys) {
    (_.isArray(foreignKeys) ? foreignKeys : [foreignKeys])
      .forEach((fk) => {
        const {
          columns,
        } = fk;
        constraints.push(`FOREIGN KEY (${quote(_.isArray(columns) ? columns : [columns]).join(', ')}) ${parseReferences(fk)}`);
      });
  }
  if (exclude) {
    constraints.push(`CONSTRAINT "${tableName}_excl" EXCLUDE ${exclude}`);
  }
  if (deferrable) {
    constraints.push(parseDeferrable(options));
  }

  return constraints;
};

// TABLE
export const drop = (tableName, { ifExists, cascade } = {}) =>
  template`DROP TABLE${ifExists ? ' IF EXISTS' : ''} "${tableName}"${cascade ? ' CASCADE' : ''};`;

export const create = (typeShorthands) => {
  const _create = (tableName, columns, options = {}) => {
    const {
      temporary,
      ifNotExists,
      inherits,
      like,
      constraints: optionsConstraints = {},
    } = options;
    const {
      columns: columnLines,
      constraints: columnsConstraints,
    } = parseColumns(columns, typeShorthands);
    const dupes = _.intersection(Object.keys(optionsConstraints), Object.keys(columnsConstraints));
    if (dupes.length > 0) {
      throw new Error(`There is duplicate constraint definition in table and columns options: ${dupes.join(', ')}`);
    }

    const constraints = { ...optionsConstraints, ...columnsConstraints };
    const constraintLines = parseConstraints(tableName, constraints);
    const tableDefinition = [
      ...columnLines,
      ...constraintLines,
    ].concat(like
      ? [template`LIKE "${like}"`]
      : []);

    return template`CREATE TABLE${temporary ? ' TEMPORARY' : ''}${ifNotExists ? ' IF NOT EXISTS' : ''} "${tableName}" (
${formatLines(tableDefinition, '  ')}
)${inherits ? template` INHERITS "${inherits}"` : ''};`;
  };
  _create.reverse = drop;
  return _create;
};

// COLUMNS
export const dropColumns = (tableName, columns, { ifExists, cascade } = {}) => {
  if (typeof columns === 'string') {
    columns = [columns]; // eslint-disable-line no-param-reassign
  } else if (!_.isArray(columns) && typeof columns === 'object') {
    columns = _.keys(columns); // eslint-disable-line no-param-reassign
  }
  return template`ALTER TABLE "${tableName}"
${formatLines(quote(columns), `  DROP ${ifExists ? ' IF EXISTS' : ''}`, `${cascade ? ' CASCADE' : ''},\n`)};`;
};

export const addColumns = (typeShorthands) => {
  const _add = (tableName, columns) => {
    const { columns: columnLines } = parseColumns(columns, typeShorthands);
    return template`ALTER TABLE "${tableName}"\n${formatLines(columnLines, '  ADD ')};`;
  };
  _add.reverse = dropColumns;
  return _add;
};

export const alterColumn = (tableName, columnName, options) => {
  const {
    default: defaultValue,
    type,
    collation,
    using,
    notNull,
    allowNull,
  } = options;
  const actions = [];
  if (defaultValue === null) {
    actions.push('DROP DEFAULT');
  } else if (defaultValue !== undefined) {
    actions.push(`SET DEFAULT ${escapeValue(defaultValue)}`);
  }
  if (type) {
    actions.push(`SET DATA TYPE ${applyTypeAdapters(type)}${collation ? `COLLATE ${collation}` : ''}${using ? ` USING ${using}` : ''}`);
  }
  if (notNull) {
    actions.push('SET NOT NULL');
  } else if (notNull === false || allowNull) {
    actions.push('DROP NOT NULL');
  }

  return template`ALTER TABLE "${tableName}"\n${formatLines(actions, `  ALTER "${columnName}" `)};`;
};

// RENAME
export const renameTable = (tableName, newName) =>
  template`ALTER TABLE "${tableName}" RENAME TO "${newName}";`;

export const undoRenameTable = (tableName, newName) =>
  renameTable(newName, tableName);

export const renameColumn = (tableName, columnName, newName) =>
  template`ALTER TABLE "${tableName}" RENAME "${columnName}" TO "${newName}";`;

export const undoRenameColumn = (tableName, columnName, newName) =>
  renameColumn(tableName, newName, columnName);

export const renameConstraint = (tableName, constraintName, newName) =>
  template`ALTER TABLE "${tableName}" RENAME CONSTRAINT "${constraintName}" TO "${newName}";`;

export const undoRenameConstraint = (tableName, constraintName, newName) =>
  renameConstraint(tableName, newName, constraintName);

// CONSTRAINTS -- only supports named check constraints
export const addConstraint = (tableName, constraintName, expression) =>
  template`ALTER TABLE "${tableName}" ADD${constraintName ? ` CONSTRAINT "${constraintName}"` : ''} ${typeof expression === 'string' ? expression : parseConstraints(tableName, expression)};`;

export const dropConstraint = (tableName, constraintName, { ifExists, cascade } = {}) =>
  template`ALTER TABLE "${tableName}" DROP CONSTRAINT${ifExists ? ' IF EXISTS' : ''} "${constraintName}"${cascade ? ' CASCADE' : ''};`;

addColumns.reverse = dropColumns;
addConstraint.reverse = dropConstraint;
renameColumn.reverse = undoRenameColumn;
renameConstraint.reverse = undoRenameConstraint;
renameTable.reverse = undoRenameTable;
