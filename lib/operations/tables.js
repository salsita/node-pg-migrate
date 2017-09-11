import _ from 'lodash';
import { escapeValue, template, quote, applyType, applyTypeAdapters } from '../utils';

function parseColumns(columns, table, extending_type_shorthands = {}) {
  let columnsWithOptions = _.mapValues(
    columns,
    column => applyType(column, extending_type_shorthands)
  );

  const table_name = typeof table === 'object' ? table.name : table;

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

  return _.map(columnsWithOptions, (options, column_name) => {
    const constraints = [];
    if (options.unique) {
      constraints.push('UNIQUE');
    }
    if (options.primaryKey) {
      constraints.push('PRIMARY KEY');
    }
    if (options.notNull) {
      constraints.push('NOT NULL');
    }
    if (options.check) {
      constraints.push(`CHECK (${options.check})`);
    }
    if (options.references) {
      constraints.push(
        typeof options.references === 'string'
          ? `REFERENCES ${options.references}`
          : template`REFERENCES "${options.references}"`
      );
      if (options.onDelete) {
        constraints.push(`ON DELETE ${options.onDelete}`);
      }
      if (options.onUpdate) {
        constraints.push(`ON UPDATE ${options.onUpdate}`);
      }
    }

    const defaultValue = options.default !== undefined ? ` DEFAULT ${escapeValue(options.default)}` : '';
    const constraintsString = constraints.length ? ` ${constraints.join(' ')}` : '';

    return template`"${column_name}" ${options.type}${defaultValue}${constraintsString}`;
  })
    .concat(multiplePrimaryColumns
      ? [`CONSTRAINT "${table_name}_pkey" PRIMARY KEY (${quote(primaryColumns).join(', ')})`]
      : []
    )
    .join(',\n');
}

export const drop = table_name =>
  template`DROP TABLE "${table_name}";`;

export const create = (type_shorthands) => {
  const _create = (table_name, columns, options = {}) => {
    /*
     columns - hash of columns

     Options
     table_name - the name of the table
     columns - see column options
     options.inherits - table to inherit from (optional)
     */
    const columnsString = parseColumns(columns, table_name, type_shorthands).replace(/^/gm, '  ');
    const inherits = options.inherits ? ` INHERITS ${options.inherits}` : '';
    return template`CREATE TABLE "${table_name}" (\n${columnsString}\n)${inherits};`;
  };
  _create.reverse = drop;
  return _create;
};

export const dropColumns = (table_name, columns) => {
  if (typeof columns === 'string') {
    columns = [columns]; // eslint-disable-line no-param-reassign
  } else if (!_.isArray(columns) && typeof columns === 'object') {
    columns = _.keys(columns); // eslint-disable-line no-param-reassign
  }
  return template`ALTER TABLE "${table_name}"\n${quote(columns).join(',\n').replace(/^/gm, '  DROP ')};`;
};

export const addColumns = (type_shorthands) => {
  const _add = (table_name, columns) =>
    template`ALTER TABLE "${table_name}"\n${parseColumns(columns, table_name, type_shorthands).replace(/^/gm, '  ADD ')};`;
  _add.reverse = dropColumns;
  return _add;
};

export const alterColumn = (table_name, column_name, options) => {
  const actions = [];
  if (options.default === null) {
    actions.push('DROP DEFAULT');
  } else if (options.default !== undefined) {
    actions.push(`SET DEFAULT ${escapeValue(options.default)}`);
  }
  if (options.type) {
    const action = `SET DATA TYPE ${applyTypeAdapters(options.type)}`;
    actions.push(
      options.using
        ? `${action} USING ${options.using}`
        : action
    );
  }
  if (options.notNull) {
    actions.push('SET NOT NULL');
  } else if (options.notNull === false || options.allowNull) {
    actions.push('DROP NOT NULL');
  }

  return template`ALTER TABLE "${table_name}"\n${actions.join(',\n').replace(/^/gm, `  ALTER "${column_name}" `)};`;
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

// CONSTRAINTS -- only supports named check constraints
export const addConstraint = (table_name, constraint_name, expression) =>
  template`ALTER TABLE "${table_name}" ADD${constraint_name ? ` CONSTRAINT "${constraint_name}"` : ''} ${expression};`;

export const dropConstraint = (table_name, constraint_name) =>
  template`ALTER TABLE "${table_name}" DROP CONSTRAINT "${constraint_name}";`;

addColumns.reverse = dropColumns;
addConstraint.reverse = dropConstraint;
renameColumn.reverse = undoRenameColumn;
renameTable.reverse = undoRenameTable;
