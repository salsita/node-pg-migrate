import { describe, expect, it, vi } from 'vitest';
import type { MigrationBuilder } from '../src/migrationBuilder';
import { getActions } from '../src/sqlMigration';

describe('sqlMigration', () => {
  describe('getActions', () => {
    it.each([
      '-- noTransaction\n',
      '-- no transaction\n',
      '-- notransaction\n',
      '-- no\t\t transaction\n',
      '\uFEFF\r\n-- description\r\n  -- NO TRANSACTION \r\n',
      '\n-- another comment\n\t-- noTransaction\n',
    ])('recognizes a standalone header directive %j', async (header) => {
      const content = `${header}SELECT 1;`;
      const { up, down } = getActions(content);
      const sql = vi.fn();
      const noTransaction = vi.fn();

      expect(up).toBeTypeOf('function');
      if (up) {
        await up({ sql, noTransaction } as unknown as MigrationBuilder);
      }
      expect(noTransaction).toHaveBeenCalledExactlyOnceWith();
      expect(sql).toHaveBeenCalledExactlyOnceWith(
        content.replace(/^\uFEFF/, '')
      );
      expect(noTransaction.mock.invocationCallOrder[0]).toBeLessThan(
        sql.mock.invocationCallOrder[0]
      );
      expect(down).toBe(false);
    });

    it.each([false, true])(
      'omits only an initial BOM (directive: %s)',
      async (directive) => {
        const content = `\uFEFF${directive ? '-- noTransaction\r\n' : ''}SELECT '\uFEFF';\r\n`;
        const { up } = getActions(content);
        const sql = vi.fn();
        const noTransaction = vi.fn();
        if (up) {
          await up({ sql, noTransaction } as unknown as MigrationBuilder);
        }
        expect(sql).toHaveBeenCalledExactlyOnceWith(content.slice(1));
        expect(noTransaction).toHaveBeenCalledTimes(directive ? 1 : 0);
      }
    );

    it.each([
      '-- no transaction is needed\nSELECT 1;',
      '-- description mentions noTransaction\nSELECT 1;',
      '-- noTransactionEnabled\nSELECT 1;',
      'SELECT 1; -- noTransaction',
      'SELECT 1;\n-- noTransaction',
      "SELECT '\n-- noTransaction\n';",
      'DO $body$\n-- noTransaction\nBEGIN END;\n$body$;',
      '/*\n-- noTransaction\n*/\nSELECT 1;',
      '/* header */\n-- noTransaction\nSELECT 1;',
    ])('keeps transaction behavior for %j', async (content) => {
      const { up } = getActions(content);
      const sql = vi.fn();
      const noTransaction = vi.fn();

      if (up) {
        await up({ sql, noTransaction } as unknown as MigrationBuilder);
      }
      expect(noTransaction).not.toHaveBeenCalled();
      expect(sql).toHaveBeenCalledExactlyOnceWith(content);
    });

    it.each([false, true])(
      'applies the file directive to both legacy sections (down first: %s)',
      async (downFirst) => {
        const header = '\uFEFF-- file description\n-- noTransaction\n';
        const upSection = '\n-- Up Migration\nSELECT 1;\n';
        const downSection = '\n-- Down Migration\nSELECT 2;\n';
        const content =
          header +
          (downFirst ? downSection + upSection : upSection + downSection);
        const { up, down } = getActions(content);

        for (const [action, section] of [
          [up, upSection],
          [down, downSection],
        ] as const) {
          const sql = vi.fn();
          const noTransaction = vi.fn();
          expect(action).toBeTypeOf('function');
          if (action) {
            await action({ sql, noTransaction } as unknown as MigrationBuilder);
          }
          expect(sql).toHaveBeenCalledExactlyOnceWith(section);
          expect(noTransaction).toHaveBeenCalledExactlyOnceWith();
          expect(noTransaction.mock.invocationCallOrder[0]).toBeLessThan(
            sql.mock.invocationCallOrder[0]
          );
        }
      }
    );

    it.each([
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ])(
      'ignores section directives in either order (down first: %s, directive in first: %s)',
      async (downFirst, directiveInFirst) => {
        const upSection = `-- Up Migration\n${downFirst === directiveInFirst ? '' : '-- noTransaction\n'}SELECT 1;\n`;
        const downSection = `-- Down Migration\n${downFirst === directiveInFirst ? '-- noTransaction\n' : ''}SELECT 2;\n`;
        const { up, down } = getActions(
          downFirst ? downSection + upSection : upSection + downSection
        );
        for (const [action, section] of [
          [up, upSection],
          [down, downSection],
        ] as const) {
          const noTransaction = vi.fn();
          const sql = vi.fn();
          if (action) {
            await action({ sql, noTransaction } as unknown as MigrationBuilder);
          }
          expect(noTransaction).not.toHaveBeenCalled();
          expect(sql).toHaveBeenCalledExactlyOnceWith(section);
        }
      }
    );

    it('should migrate without comments', () => {
      const content = 'SELECT 1 FROM something';
      const { up, down } = getActions(content);

      expect(up).toBeTypeOf('function');
      expect(down).toBe(false);

      const sql = vi.fn();

      expect(
        // @ts-expect-error: simplified for testing
        up({ sql })
      ).not.toBeDefined();
      expect(sql).toHaveBeenCalled();
      expect(sql).toHaveBeenLastCalledWith(content.trim());
    });

    it('should not run the down section in up without an up comment', () => {
      const upMigration = 'CREATE TABLE t (i integer);\n';
      const downMigration = '-- Down Migration\nDROP TABLE t;\n';
      const { up, down } = getActions(`${upMigration}${downMigration}`);

      const sql = vi.fn();

      // @ts-expect-error: simplified for testing
      up({ sql });
      expect(sql).toHaveBeenLastCalledWith(upMigration);

      expect(down).toBeTypeOf('function');
      // @ts-expect-error: simplified for testing
      down({ sql });
      expect(sql).toHaveBeenLastCalledWith(downMigration);
    });

    it.each([
      [
        'single-quoted string',
        "SELECT '\n-- Down Migration\n-- Up Migration\n';\n",
      ],
      ['doubled single quote', "SELECT 'it''s\n-- Down Migration\n';\n"],
      [
        'escape string',
        String.raw`SELECT E'it\'s
-- Down Migration
-- Up Migration
';
`,
      ],
      [
        'continued escape string',
        String.raw`SELECT E'first'
  'it\'s
-- Down Migration
-- Up Migration
';
`,
      ],
      [
        'quoted identifier',
        'CREATE TABLE "table\n-- Down Migration\n-- Up Migration\n" (id integer);\n',
      ],
      [
        'doubled identifier quote',
        'CREATE TABLE "table""name\n-- Down Migration\n" (id integer);\n',
      ],
      [
        'untagged dollar string',
        'SELECT $$\n-- Down Migration\n-- Up Migration\n$$;\n',
      ],
      [
        'tagged dollar string',
        'SELECT $body$\n-- Down Migration\n-- Up Migration\n$body$;\n',
      ],
      [
        'Unicode dollar tag',
        'SELECT $表_1$\n-- Down Migration\n-- Up Migration\n$表_1$;\n',
      ],
      [
        'case-sensitive dollar tag',
        'SELECT $body$\n$BODY$\n-- Down Migration\n$body$;\n',
      ],
      [
        'block comment',
        '/*\n-- Down Migration\n-- Up Migration\n*/\nSELECT 1;\n',
      ],
      [
        'nested block comment',
        '/* outer /* inner */\n-- Down Migration\n-- Up Migration\n*/\nSELECT 1;\n',
      ],
      ['line comment containing quotes', '-- \' $$ /* "\nSELECT 1;\n'],
      [
        'line comment containing a Unicode line separator',
        '-- ordinary\u2028-- Down Migration\nSELECT 1;\n',
      ],
      [
        'line comment containing a Unicode paragraph separator',
        '-- ordinary\u2029-- Up Migration\nSELECT 1;\n',
      ],
      [
        'comment whose marker words cross a newline',
        'CREATE TABLE\n-- Down\nmigration (id integer);\n',
      ],
      [
        'comment whose marker starts on another line',
        'CREATE TABLE\n--\nup migration (id integer);\n',
      ],
      ['unterminated dollar string', 'SELECT $body$\n-- Down Migration\n'],
      ['unterminated block comment', '/*\n-- Down Migration\n'],
      ['unterminated escape string', "SELECT E'trailing\\"],
    ])('ignores markers inside a %s', async (_label, content) => {
      const { up, down } = getActions(content);
      const sql = vi.fn();
      expect(up).toBeTypeOf('function');
      if (up) {
        await up({ sql } as unknown as MigrationBuilder);
      }
      expect(sql).toHaveBeenCalledExactlyOnceWith(content);
      expect(down).toBe(false);
    });

    it.each([false, true])(
      'finds real boundaries after quoted SQL (down first: %s)',
      async (downFirst) => {
        const upSection =
          '\n-- Up Migration\nSELECT $body$\n-- Down Migration\n$body$;\n';
        const downSection =
          "\n-- Down Migration\nSELECT '\n-- Up Migration\n';\n";
        const { up, down } = getActions(
          downFirst ? downSection + upSection : upSection + downSection
        );
        for (const [action, expected] of [
          [up, upSection],
          [down, downSection],
        ] as const) {
          const sql = vi.fn();
          expect(action).toBeTypeOf('function');
          if (action) {
            await action({ sql } as unknown as MigrationBuilder);
          }
          expect(sql).toHaveBeenCalledExactlyOnceWith(expected);
        }
      }
    );

    it.each([
      'SELECT name$tag$ FROM source;\n',
      'SELECT 表$tag$ FROM source;\n',
      'SELECT $1;\n',
      "SELECT 'backslash\\';\n",
      String.raw`SELECT E'backslash\\';
`,
      '/* outer /* inner */ remaining */\nSELECT 1;\n',
      'SELECT $body$some text$body$;\n',
      '-- unmatched \' " $body$ /*\r\nSELECT 1;\n',
    ])('finds a real down marker after %j', async (prefix) => {
      const downSection = '-- Down Migration\nSELECT 2;';
      const { up, down } = getActions(prefix + downSection);
      const sql = vi.fn();
      if (up) {
        await up({ sql } as unknown as MigrationBuilder);
      }
      expect(sql).toHaveBeenCalledExactlyOnceWith(prefix);
      expect(down).toBeTypeOf('function');
      if (down) {
        await down({ sql } as unknown as MigrationBuilder);
      }
      expect(sql).toHaveBeenLastCalledWith(downSection);
    });

    it('preserves Unicode whitespace inside a genuine marker comment', async () => {
      const upSection = 'SELECT 1;\n';
      const downSection = '--\u00A0- down\u2003migration\nSELECT 2;';
      const { up, down } = getActions(upSection + downSection);
      const sql = vi.fn();
      if (up) {
        await up({ sql } as unknown as MigrationBuilder);
      }
      expect(sql).toHaveBeenCalledExactlyOnceWith(upSection);
      expect(down).toBeTypeOf('function');
      if (down) {
        await down({ sql } as unknown as MigrationBuilder);
      }
      expect(sql).toHaveBeenLastCalledWith(downSection);
    });

    it('should migrate with up comment', () => {
      const content = `
-- Up Migration
SELECT 1 FROM something
`;
      const { up, down } = getActions(content);

      expect(up).toBeTypeOf('function');
      expect(down).toBe(false);

      const sql = vi.fn();

      expect(
        // @ts-expect-error: simplified for testing
        up({ sql })
      ).not.toBeDefined();
      expect(sql).toHaveBeenCalled();
      expect(sql).toHaveBeenLastCalledWith(content);
    });

    it('should migrate with up and down comments', () => {
      const upMigration = `
-- Up Migration
SELECT 1 FROM something
`;
      const downMigration = `
-- Down Migration
SELECT 2 FROM something
`;
      const content = `${upMigration}${downMigration}`;

      const { up, down } = getActions(content);

      expect(up).toBeTypeOf('function');
      expect(down).toBeTypeOf('function');

      const upSql = vi.fn();

      expect(
        // @ts-expect-error: simplified for testing
        up({ sql: upSql })
      ).not.toBeDefined();
      expect(upSql).toHaveBeenCalled();
      expect(upSql).toHaveBeenLastCalledWith(upMigration);

      const downSql = vi.fn();

      expect(
        // @ts-expect-error: simplified for testing
        down({ sql: downSql })
      ).not.toBeDefined();
      expect(downSql).toHaveBeenCalled();
      expect(downSql).toHaveBeenLastCalledWith(downMigration);
    });

    it('should migrate with up and down comments in reverse order', () => {
      const upMigration = `
-- Up Migration
SELECT 1 FROM something
`;
      const downMigration = `
-- Down Migration
SELECT 2 FROM something
`;
      const content = `${downMigration}${upMigration}`;

      const { up, down } = getActions(content);

      expect(up).toBeTypeOf('function');
      expect(down).toBeTypeOf('function');

      const upSql = vi.fn();

      expect(
        // @ts-expect-error: simplified for testing
        up({ sql: upSql })
      ).not.toBeDefined();
      expect(upSql).toHaveBeenCalled();
      expect(upSql).toHaveBeenLastCalledWith(upMigration);

      const downSql = vi.fn();

      expect(
        // @ts-expect-error: simplified for testing
        down({ sql: downSql })
      ).not.toBeDefined();
      expect(downSql).toHaveBeenCalled();
      expect(downSql).toHaveBeenLastCalledWith(downMigration);
    });

    it('should migrate with up and down comments with some chars added', () => {
      const upMigration = `
 -- - up Migration to do Up migration
SELECT 1 FROM something
`;
      const downMigration = `
  -- -- -- Down    migration to bring DB down
SELECT 2 FROM something
`;
      const content = `${upMigration}${downMigration}`;

      const { up, down } = getActions(content);

      expect(up).toBeTypeOf('function');
      expect(down).toBeTypeOf('function');

      const upSql = vi.fn();

      expect(
        // @ts-expect-error: simplified for testing
        up({ sql: upSql })
      ).not.toBeDefined();
      expect(upSql).toHaveBeenCalled();
      expect(upSql).toHaveBeenLastCalledWith(upMigration);

      const downSql = vi.fn();

      expect(
        // @ts-expect-error: simplified for testing
        down({ sql: downSql })
      ).not.toBeDefined();
      expect(downSql).toHaveBeenCalled();
      expect(downSql).toHaveBeenLastCalledWith(downMigration);
    });
  });
});
