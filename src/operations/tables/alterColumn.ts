import type { MigrationOptions } from '../../migrationOptions';
import {
  applyTypeAdapters,
  escapeValue,
  formatLines,
  makeComment,
} from '../../utils';
import type { Name, Value } from '../generalTypes';
import { parseSequenceOptions } from '../sequences';
import type { SequenceGeneratedOptions } from './shared';

export interface AlterColumnOptions {
  type?: string;

  default?: Value;

  notNull?: boolean;

  allowNull?: boolean;

  collation?: string;

  using?: string;

  comment?: string | null;

  sequenceGenerated?: null | false | SequenceGeneratedOptions;
  expressionGenerated?: null | string;
}

export type AlterColumn = (
  tableName: Name,
  columnName: string,
  options: AlterColumnOptions
) => string;

export function alterColumn(mOptions: MigrationOptions): AlterColumn {
  return (tableName, columnName, options) => {
    const {
      default: defaultValue,
      type,
      collation,
      using,
      notNull,
      allowNull,
      comment,
      expressionGenerated,
    } = options;

    const sequenceGenerated = options.sequenceGenerated;

    const actions: string[] = [];

    if (defaultValue === null) {
      actions.push('DROP DEFAULT');
    } else if (defaultValue !== undefined) {
      actions.push(`SET DEFAULT ${escapeValue(defaultValue)}`);
    }

    if (type) {
      const typeStr = applyTypeAdapters(type);
      const collationStr = collation ? ` COLLATE ${collation}` : '';
      const usingStr = using ? ` USING ${using}` : '';

      actions.push(`SET DATA TYPE ${typeStr}${collationStr}${usingStr}`);
    }

    if (notNull) {
      actions.push('SET NOT NULL');
    } else if (notNull === false || allowNull) {
      actions.push('DROP NOT NULL');
    }

    if (sequenceGenerated !== undefined) {
      if (sequenceGenerated) {
        const sequenceOptions = parseSequenceOptions(
          mOptions.typeShorthands,
          sequenceGenerated
        ).join(' ');

        actions.push(
          `ADD GENERATED ${sequenceGenerated.precedence} AS IDENTITY${sequenceOptions ? ` (${sequenceOptions})` : ''}`
        );
      } else {
        actions.push('DROP IDENTITY');
      }
    }

    if (expressionGenerated !== undefined) {
      if (typeof expressionGenerated === 'string') {
        actions.push(`SET EXPRESSION AS (${expressionGenerated})`);
      }

      if (expressionGenerated === null) {
        actions.push('DROP EXPRESSION');
      }
    }

    const queries: string[] = [];

    if (actions.length > 0) {
      const columnsStr = formatLines(
        actions,
        `  ALTER ${mOptions.literal(columnName)} `
      );

      queries.push(
        `ALTER TABLE ${mOptions.literal(tableName)}\n${columnsStr};`
      );
    }

    if (comment !== undefined) {
      queries.push(
        makeComment(
          'COLUMN',
          `${mOptions.literal(tableName)}.${mOptions.literal(columnName)}`,
          comment
        )
      );
    }

    return queries.join('\n');
  };
}
