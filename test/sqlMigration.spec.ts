import { describe, expect, it, vi } from 'vitest';
import type { MigrationBuilder } from '../src/migrationBuilder';
import { getActions } from '../src/sqlMigration';

describe('sqlMigration', () => {
  describe('getActions', () => {
    it.each([
      '-- noTransaction\n',
      '-- no transaction\n',
      '\uFEFF\r\n-- description\r\n  -- NO TRANSACTION \r\n',
      '\n-- Up Migration\n-- another comment\n\t-- noTransaction\n',
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

    it('omits only an initial BOM and preserves the remaining SQL', async () => {
      const content = "\uFEFF-- noTransaction\r\nSELECT '\uFEFF';\r\n";
      const { up } = getActions(content);
      const sql = vi.fn();
      const noTransaction = vi.fn();
      if (up) {
        await up({ sql, noTransaction } as unknown as MigrationBuilder);
      }
      expect(sql).toHaveBeenCalledExactlyOnceWith(content.slice(1));
      expect(noTransaction).toHaveBeenCalledExactlyOnceWith();
    });

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

    it('ignores a directive in a later legacy section', async () => {
      const { down } = getActions(
        '-- Up Migration\nSELECT 1;\n-- Down Migration\n-- noTransaction\nSELECT 2;'
      );
      const noTransaction = vi.fn();
      if (down) {
        await down({
          sql: vi.fn(),
          noTransaction,
        } as unknown as MigrationBuilder);
      }
      expect(noTransaction).not.toHaveBeenCalled();
    });

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
