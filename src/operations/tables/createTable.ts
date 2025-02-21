import type { MigrationOptions } from '../../migrationOptions';
import {
  formatLines,
  formatPartitionColumns,
  intersection,
  makeComment,
} from '../../utils';
import type { Name, Reversible } from '../generalTypes';
import type { DropTableOptions } from './dropTable';
import { dropTable } from './dropTable';
import type {
  ColumnDefinitions,
  ConstraintOptions,
  TableOptions,
} from './shared';
import { parseColumns, parseConstraints, parseLike } from './shared';

export type CreateTableFn = (
  tableName: Name,
  columns: ColumnDefinitions,
  options?: TableOptions & DropTableOptions
) => string;

export type CreateTable = Reversible<CreateTableFn>;

export function createTable(mOptions: MigrationOptions): CreateTable {
  const _create: CreateTable = (tableName, columns, options = {}) => {
    const {
      temporary = false,
      ifNotExists = false,
      inherits,
      like,
      constraints: optionsConstraints = {},
      comment,
      partition,
    } = options;

    const {
      columns: columnLines,
      constraints: crossColumnConstraints,
      comments: columnComments = [],
    } = parseColumns(tableName, columns, mOptions);

    const dupes = intersection(
      Object.keys(optionsConstraints),
      Object.keys(crossColumnConstraints)
    );

    if (dupes.length > 0) {
      const dupesStr = dupes.join(', ');
      throw new Error(
        `There is duplicate constraint definition in table and columns options: ${dupesStr}`
      );
    }

    const constraints: ConstraintOptions = {
      ...optionsConstraints,
      ...crossColumnConstraints,
    };
    const { constraints: constraintLines, comments: constraintComments } =
      parseConstraints(tableName, constraints, '', mOptions.literal);
    const tableDefinition = [
      ...columnLines,
      ...constraintLines,
      ...(like ? [parseLike(like, mOptions.literal)] : []),
    ];

    const temporaryStr = temporary ? ' TEMPORARY' : '';
    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : '';
    const inheritsStr = inherits
      ? ` INHERITS (${mOptions.literal(inherits)})`
      : '';

    const partitionStr = partition
      ? ` PARTITION BY ${partition.strategy} (${formatPartitionColumns(partition, mOptions.literal)})`
      : '';

    const tableNameStr = mOptions.literal(tableName);

    const createTableQuery = `CREATE${temporaryStr} TABLE${ifNotExistsStr} ${tableNameStr} (
${formatLines(tableDefinition)}
)${inheritsStr}${partitionStr};`;
    const comments = [...columnComments, ...constraintComments];

    if (comment !== undefined) {
      comments.push(makeComment('TABLE', mOptions.literal(tableName), comment));
    }

    return `${createTableQuery}${comments.length > 0 ? `\n${comments.join('\n')}` : ''}`;
  };

  _create.reverse = dropTable(mOptions);

  return _create;
}
