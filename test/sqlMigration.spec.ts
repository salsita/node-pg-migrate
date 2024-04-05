import { describe, expect, it, vi } from 'vitest';
import { getActions } from '../src/sqlMigration';

describe('sqlMigration', () => {
  describe('getActions', () => {
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
