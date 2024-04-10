import type { MigrationOptions } from '../../types';
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

  /**
   * @deprecated use sequenceGenerated
   */
  generated?: null | false | SequenceGeneratedOptions;

  sequenceGenerated?: null | false | SequenceGeneratedOptions;
}

export type AlterColumn = (
  tableName: Name,
  columnName: string,
  options: AlterColumnOptions
) => string | string[];

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
    } = options;

    const sequenceGenerated =
      options.sequenceGenerated === undefined
        ? options.generated
        : options.sequenceGenerated;

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
      if (!sequenceGenerated) {
        actions.push('DROP IDENTITY');
      } else {
        const sequenceOptions = parseSequenceOptions(
          mOptions.typeShorthands,
          sequenceGenerated
        ).join(' ');

        actions.push(
          `ADD GENERATED ${sequenceGenerated.precedence} AS IDENTITY${sequenceOptions ? ` (${sequenceOptions})` : ''}`
        );
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

    if (typeof comment !== 'undefined') {
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
