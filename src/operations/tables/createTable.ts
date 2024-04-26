import type { MigrationOptions } from '../../types';
import { formatLines, intersection, makeComment } from '../../utils';
import type { DropOptions, Name, Reversible } from '../generalTypes';
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
  options?: TableOptions & DropOptions
) => string;

export type CreateTable = Reversible<CreateTableFn>;

export function createTable(mOptions: MigrationOptions): CreateTable {
  const _create: CreateTable = (tableName, columns, options = {}) => {
    const {
      temporary,
      ifNotExists,
      inherits,
      like,
      constraints: optionsConstraints = {},
      comment,
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
    const tableDefinition = [...columnLines, ...constraintLines].concat(
      like ? [parseLike(like, mOptions.literal)] : []
    );

    const temporaryStr = temporary ? ' TEMPORARY' : '';
    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : '';
    const inheritsStr = inherits
      ? ` INHERITS (${mOptions.literal(inherits)})`
      : '';
    const tableNameStr = mOptions.literal(tableName);

    const createTableQuery = `CREATE${temporaryStr} TABLE${ifNotExistsStr} ${tableNameStr} (
${formatLines(tableDefinition)}
)${inheritsStr};`;
    const comments = [...columnComments, ...constraintComments];

    if (typeof comment !== 'undefined') {
      comments.push(makeComment('TABLE', mOptions.literal(tableName), comment));
    }

    return `${createTableQuery}${comments.length > 0 ? `\n${comments.join('\n')}` : ''}`;
  };

  _create.reverse = dropTable(mOptions);

  return _create;
}
