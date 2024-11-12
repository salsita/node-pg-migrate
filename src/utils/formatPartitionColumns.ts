import type {
  PartitionColumnOptions,
  PartitionOptions,
} from '../operations/tables';
import { toArray } from './toArray';

function formatPartitionColumn(
  column: string | PartitionColumnOptions,
  literal: (value: string) => string
): string {
  if (typeof column === 'string') {
    return literal(column);
  }

  let formatted = literal(column.name);

  if (column.collate) {
    formatted += ` COLLATE ${column.collate}`;
  }

  if (column.opclass) {
    formatted += ` ${column.opclass}`;
  }

  return formatted;
}

// Helper function to format all partition columns
export function formatPartitionColumns(
  partition: PartitionOptions,
  literal: (value: string) => string
): string {
  const columns = toArray(partition.columns);
  return columns.map((col) => formatPartitionColumn(col, literal)).join(', ');
}
