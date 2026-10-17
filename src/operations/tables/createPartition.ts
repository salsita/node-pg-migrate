import type { MigrationOptions } from '../../migrationOptions';
import { escapeValue, formatPartitionColumns, makeComment } from '../../utils';
import type { Name, Reversible, Value } from '../generalTypes';
import type { DropTableOptions } from './dropTable';
import { dropTable } from './dropTable';
import type { TableOptions } from './shared';

export type PartitionBound =
  | { strategy: 'RANGE'; from: Value[]; to: Value[] }
  | { strategy: 'LIST'; values: Value[] }
  | { strategy: 'HASH'; modulus: number; remainder: number }
  | { strategy: 'DEFAULT' };

export type CreatePartitionOptions = Pick<
  TableOptions,
  'ifNotExists' | 'temporary' | 'unlogged' | 'partition' | 'comment'
>;

export type CreatePartitionFn = (
  tableName: Name,
  parentTableName: Name,
  bound: PartitionBound,
  options?: CreatePartitionOptions & DropTableOptions
) => string;

export type CreatePartition = Reversible<CreatePartitionFn>;

function formatBound(bound: PartitionBound): string {
  switch (bound.strategy) {
    case 'RANGE':
      if (
        !Array.isArray(bound.from) ||
        !Array.isArray(bound.to) ||
        bound.from.length === 0 ||
        bound.from.length !== bound.to.length
      ) {
        throw new Error(
          'RANGE partition bounds must have matching, nonempty from/to lists'
        );
      }
      return `FOR VALUES FROM (${bound.from.map(escapeValue).join(', ')}) TO (${bound.to.map(escapeValue).join(', ')})`;
    case 'LIST':
      if (!Array.isArray(bound.values) || bound.values.length === 0) {
        throw new Error(
          'LIST partition bounds must have a nonempty values list'
        );
      }
      return `FOR VALUES IN (${bound.values.map(escapeValue).join(', ')})`;
    case 'HASH':
      if (
        !Number.isSafeInteger(bound.modulus) ||
        bound.modulus <= 0 ||
        bound.modulus > 2_147_483_647 ||
        !Number.isSafeInteger(bound.remainder) ||
        bound.remainder < 0 ||
        bound.remainder >= bound.modulus
      ) {
        throw new Error(
          'HASH partition bounds require an integer modulus between 1 and 2147483647 and an integer remainder between zero and modulus - 1'
        );
      }
      return `FOR VALUES WITH (MODULUS ${bound.modulus}, REMAINDER ${bound.remainder})`;
    case 'DEFAULT':
      return 'DEFAULT';
    default:
      throw new Error('Unsupported partition bound strategy');
  }
}

export function createPartition(mOptions: MigrationOptions): CreatePartition {
  const _create: CreatePartition = (
    tableName,
    parentTableName,
    bound,
    options = {}
  ) => {
    const { ifNotExists, temporary, unlogged, partition, comment } = options;
    if (temporary && unlogged) {
      throw new Error('TEMPORARY and UNLOGGED cannot be used together.');
    }

    const temporaryStr = temporary ? ' TEMPORARY' : '';
    const unloggedStr = unlogged ? ' UNLOGGED' : '';
    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : '';
    const partitionStr = partition
      ? ` PARTITION BY ${partition.strategy} (${formatPartitionColumns(partition, mOptions.literal)})`
      : '';
    const tableNameStr = mOptions.literal(tableName);
    const parentTableNameStr = mOptions.literal(parentTableName);
    const queries = [
      `CREATE${temporaryStr}${unloggedStr} TABLE${ifNotExistsStr} ${tableNameStr} PARTITION OF ${parentTableNameStr} ${formatBound(bound)}${partitionStr};`,
    ];
    if (comment !== undefined) {
      queries.push(makeComment('TABLE', tableNameStr, comment));
    }
    return queries.join('\n');
  };

  _create.reverse = (tableName, parentTableName, bound, options) => {
    const drop = dropTable(mOptions)(tableName, options);
    // DETACH has no IF EXISTS for the child, so preserve the optional drop path.
    if (options?.ifExists) {
      return drop;
    }

    // Detaching preserves parent foreign keys and refuses referenced rows.
    return `ALTER TABLE ${mOptions.literal(parentTableName)} DETACH PARTITION ${mOptions.literal(tableName)};\n${drop}`;
  };

  return _create;
}
