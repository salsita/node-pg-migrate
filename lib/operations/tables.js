import _ from 'lodash';
import { escapeValue, template, quote, applyType, applyTypeAdapters } from '../utils';

const formatLines = (lines, replace, separator = ',\n') =>
  lines.join(separator).replace(/^/gm, replace);

const parseReferences = (options) => {
  const {
    references,
    match = 'SIMPLE',
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

const parseColumns = (columns, extending_type_shorthands = {}) => {
  let columnsWithOptions = _.mapValues(
    columns,
    column => applyType(column, extending_type_shorthands)
  );

  const primaryColumns = _.chain(columnsWithOptions)
    .map((options, column_name) => (options.primaryKey ? column_name : null))
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
    columns: _.map(columnsWithOptions, (options, column_name) => {
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

      return template`"${column_name}" ${type}${constraintsString}`;
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
  const table_name = typeof table === 'object' ? table.name : table;
  const constraints = [];
  if (check) {
    constraints.push(`CONSTRAINT "${table_name}_chck" CHECK (${check})`);
  }
  if (unique) {
    const uniqueArray = _.isArray(unique) ? unique : [unique];
    const isArrayOfArrays = uniqueArray.some(uniqueSet => _.isArray(uniqueSet));
    if (isArrayOfArrays) {
      uniqueArray.forEach((uniqueSet, i) =>
        constraints.push(`CONSTRAINT "${table_name}_uniq_${i + 1}" UNIQUE (${quote(_.isArray(uniqueSet) ? uniqueSet : [uniqueSet]).join(', ')})`)
      );
    } else {
      constraints.push(`CONSTRAINT "${table_name}_uniq" UNIQUE (${quote(uniqueArray).join(', ')})`);
    }
  }
  if (primaryKey) {
    constraints.push(`CONSTRAINT "${table_name}_pkey" PRIMARY KEY (${quote(_.isArray(primaryKey) ? primaryKey : [primaryKey]).join(', ')})`);
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
    constraints.push(`CONSTRAINT "${table_name}_excl" EXCLUDE ${exclude}`);
  }
  if (deferrable) {
    constraints.push(parseDeferrable(options));
  }

  return constraints;
};

// TABLE
export const drop = (table_name, { ifExists, cascade } = {}) =>
  template`DROP TABLE${ifExists ? ' IF EXISTS' : ''} "${table_name}"${cascade ? ' CASCADE' : ''};`;

export const create = (type_shorthands) => {
  const _create = (table_name, columns, options = {}) => {
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
    } = parseColumns(columns, type_shorthands);
    const dupes = _.intersection(Object.keys(optionsConstraints), Object.keys(columnsConstraints));
    if (dupes.length > 0) {
      throw new Error(`There is duplicate constraint definition in table and columns options: ${dupes.join(', ')}`);
    }

    const constraints = { ...optionsConstraints, ...columnsConstraints };
    const constraintLines = parseConstraints(table_name, constraints);
    const tableDefinition = [
      ...columnLines,
      ...constraintLines,
    ].concat(like
      ? [template`LIKE "${like}"`]
      : []);

    return template`CREATE TABLE${temporary ? ' TEMPORARY' : ''}${ifNotExists ? ' IF NOT EXISTS' : ''} "${table_name}" (
${formatLines(tableDefinition, '  ')}
)${inherits ? template` INHERITS "${inherits}"` : ''};`;
  };
  _create.reverse = drop;
  return _create;
};

// COLUMNS
export const dropColumns = (table_name, columns, { ifExists, cascade } = {}) => {
  if (typeof columns === 'string') {
    columns = [columns]; // eslint-disable-line no-param-reassign
  } else if (!_.isArray(columns) && typeof columns === 'object') {
    columns = _.keys(columns); // eslint-disable-line no-param-reassign
  }
  return template`ALTER TABLE "${table_name}"
${formatLines(quote(columns), `  DROP ${ifExists ? ' IF EXISTS' : ''}`, `${cascade ? ' CASCADE' : ''},\n`)};`;
};

export const addColumns = (type_shorthands) => {
  const _add = (table_name, columns) => {
    const { columns: columnLines } = parseColumns(columns, type_shorthands);
    return template`ALTER TABLE "${table_name}"\n${formatLines(columnLines, '  ADD ')};`;
  };
  _add.reverse = dropColumns;
  return _add;
};

export const alterColumn = (table_name, column_name, options) => {
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

  return template`ALTER TABLE "${table_name}"\n${formatLines(actions, `  ALTER "${column_name}" `)};`;
};

// RENAME
export const renameTable = (table_name, new_name) =>
  template`ALTER TABLE "${table_name}" RENAME TO "${new_name}";`;

export const undoRenameTable = (table_name, new_name) =>
  renameTable(new_name, table_name);

export const renameColumn = (table_name, column_name, new_name) =>
  template`ALTER TABLE "${table_name}" RENAME "${column_name}" TO "${new_name}";`;

export const undoRenameColumn = (table_name, column_name, new_name) =>
  renameColumn(table_name, new_name, column_name);

export const renameConstraint = (table_name, constraint_name, new_name) =>
  template`ALTER TABLE "${table_name}" RENAME CONSTRAINT "${constraint_name}" TO "${new_name}";`;

export const undoRenameConstraint = (table_name, constraint_name, new_name) =>
  renameConstraint(table_name, new_name, constraint_name);

// CONSTRAINTS -- only supports named check constraints
export const addConstraint = (table_name, constraint_name, expression) =>
  template`ALTER TABLE "${table_name}" ADD${constraint_name ? ` CONSTRAINT "${constraint_name}"` : ''} ${typeof expression === 'string' ? expression : parseConstraints(table_name, expression)};`;

export const dropConstraint = (table_name, constraint_name, { ifExists, cascade } = {}) =>
  template`ALTER TABLE "${table_name}" DROP CONSTRAINT${ifExists ? ' IF EXISTS' : ''} "${constraint_name}"${cascade ? ' CASCADE' : ''};`;

addColumns.reverse = dropColumns;
addConstraint.reverse = dropConstraint;
renameColumn.reverse = undoRenameColumn;
renameConstraint.reverse = undoRenameConstraint;
renameTable.reverse = undoRenameTable;
