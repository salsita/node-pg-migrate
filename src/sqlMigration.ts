import { readFile } from 'node:fs/promises';
import type { MigrationAction } from './migration';
import type { ColumnDefinitions } from './operations/tables';

function createMigrationCommentRegex(direction: 'up' | 'down'): RegExp {
  return new RegExp(
    `^\\s*--(?:[^\\S\\r\\n]|-)*${direction}[^\\S\\r\\n]+migration`,
    'im'
  );
}

/** Preserve offsets and line endings while hiding SQL literals and block comments. */
function maskSqlContexts(content: string): string {
  const identifierCharacter = /[A-Za-z_0-9$\u0080-\uFFFF]/;
  const dollarQuote =
    /\$(?:[A-Za-z_\u0080-\uFFFF][A-Za-z_0-9\u0080-\uFFFF]*)?\$/y;
  const parts: string[] = [];
  let visibleStart = 0;
  let index = 0;
  let escapeContinuation = false;
  let continuationNewline = false;

  const mask = (start: number, end: number) => {
    parts.push(
      content.slice(visibleStart, start),
      content.slice(start, end).replaceAll(/[^\r\n]/g, '\0')
    );
    visibleStart = end;
  };

  while (index < content.length) {
    const character = content[index];
    const next = content[index + 1];
    if (/\s/.test(character)) {
      continuationNewline ||= character === '\n' || character === '\r';
      index += 1;
    } else if (character === '-' && next === '-') {
      // Quotes and comment delimiters inside a line comment have no SQL meaning.
      while (
        index < content.length &&
        content[index] !== '\n' &&
        content[index] !== '\r'
      ) {
        index += 1;
      }
    } else if (character === '/' && next === '*') {
      const start = index;
      let depth = 1;
      index += 2;
      while (index < content.length && depth > 0) {
        if (content.startsWith('/*', index)) {
          depth += 1;
          index += 2;
        } else if (content.startsWith('*/', index)) {
          depth -= 1;
          index += 2;
        } else {
          continuationNewline ||=
            content[index] === '\n' || content[index] === '\r';
          index += 1;
        }
      }
      mask(start, index);
    } else if (character === "'" || character === '"') {
      const start = index;
      const backslashEscapes: boolean =
        character === "'" &&
        ((/[Ee]/.test(content[index - 1] ?? '') &&
          !identifierCharacter.test(content[index - 2] ?? '')) ||
          (escapeContinuation && continuationNewline));
      index += 1;
      while (index < content.length) {
        if (backslashEscapes && content[index] === '\\') {
          index += Math.min(2, content.length - index);
        } else if (
          content[index] === character &&
          content[index + 1] !== character
        ) {
          index += 1;
          break;
        } else {
          index += content[index] === character ? 2 : 1;
        }
      }
      mask(start, index);
      // PostgreSQL also continues E strings with an unprefixed quote after a newline.
      escapeContinuation = backslashEscapes;
      continuationNewline = false;
    } else {
      escapeContinuation = false;
      continuationNewline = false;
      dollarQuote.lastIndex = index;
      const delimiter =
        character === '$' && !identifierCharacter.test(content[index - 1] ?? '')
          ? dollarQuote.exec(content)?.[0]
          : undefined;
      if (delimiter) {
        const end = content.indexOf(delimiter, index + delimiter.length);
        const quoteEnd = end < 0 ? content.length : end + delimiter.length;
        mask(index, quoteEnd);
        index = quoteEnd;
      } else {
        index += 1;
      }
    }
  }

  parts.push(content.slice(visibleStart));
  // JavaScript treats these as line endings; PostgreSQL keeps them on the same line.
  return parts.join('').replaceAll(/[\u2028\u2029]/g, ' ');
}

export function hasNoTransactionDirective(content: string): boolean {
  let lineStart = 0;
  while (lineStart < content.length) {
    const newline = content.indexOf('\n', lineStart);
    const lineEnd = newline < 0 ? content.length : newline;
    const headerLine = content.slice(lineStart, lineEnd).trim();
    lineStart = lineEnd + 1;
    if (!headerLine) {
      continue;
    }
    if (!headerLine.startsWith('--')) {
      return false;
    }
    if (/^--[ \t]*no[ \t]*transaction[ \t]*$/i.test(headerLine)) {
      return true;
    }
  }
  return false;
}

/**
 * Queue SQL, disabling its transaction first when the caller found a header
 * directive. Omit only a leading UTF-8 encoding marker from the queued SQL.
 */
export function createSqlMigrationAction(
  sql: string,
  noTransaction: boolean
): MigrationAction {
  const sqlContent = sql.startsWith('\uFEFF') ? sql.slice(1) : sql;
  return (pgm) => {
    if (noTransaction) {
      pgm.noTransaction();
    }
    pgm.sql(sqlContent);
  };
}

export interface MigrationBuilderActions {
  up?: MigrationAction | false;

  down?: MigrationAction | false;

  shorthands?: ColumnDefinitions;
}

export function getActions(content: string): MigrationBuilderActions {
  const upMigrationCommentRegex = createMigrationCommentRegex('up');
  const downMigrationCommentRegex = createMigrationCommentRegex('down');

  const searchable = maskSqlContexts(content);
  const upMigrationStart = searchable.search(upMigrationCommentRegex);
  const downMigrationStart = searchable.search(downMigrationCommentRegex);
  const headerEnd = Math.min(
    upMigrationStart < 0 ? content.length : upMigrationStart,
    downMigrationStart < 0 ? content.length : downMigrationStart
  );
  const noTransaction = hasNoTransactionDirective(content.slice(0, headerEnd));

  const upSql =
    upMigrationStart >= 0
      ? content.slice(
          upMigrationStart,
          downMigrationStart < upMigrationStart ? undefined : downMigrationStart
        )
      : content.slice(
          0,
          downMigrationStart < 0 ? undefined : downMigrationStart
        );

  const downSql =
    downMigrationStart >= 0
      ? content.slice(
          downMigrationStart,
          upMigrationStart < downMigrationStart ? undefined : upMigrationStart
        )
      : undefined;

  return {
    up: createSqlMigrationAction(upSql, noTransaction),

    down:
      downSql === undefined
        ? false
        : createSqlMigrationAction(downSql, noTransaction),
  };
}

export async function sqlMigration(
  sqlPath: string
): Promise<MigrationBuilderActions> {
  const content = await readFile(sqlPath, 'utf8');

  return getActions(content);
}
