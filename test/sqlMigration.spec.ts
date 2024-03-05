import { describe, expect, it, vi } from 'vitest';
import { getActions } from '../src/sqlMigration';

describe('lib/sqlMigration', () => {
  describe('getActions', () => {
    it('without comments', () => {
      const content = 'SELECT 1 FROM something';
      const { up, down } = getActions(content);

      expect(up).toBeDefined();
      expect(down).toBeFalsy();

      const sql = vi.fn();

      expect(up({ sql })).not.toBeDefined();
      expect(sql).toHaveBeenCalled();
      expect(sql).toHaveBeenLastCalledWith(content.trim());
    });

    it('with up comment', () => {
      const content = `
-- Up Migration
SELECT 1 FROM something
`;
      const { up, down } = getActions(content);

      expect(up).toBeDefined();
      expect(down).toBeFalsy();

      const sql = vi.fn();

      expect(up({ sql })).not.toBeDefined();
      expect(sql).toHaveBeenCalled();
      expect(sql).toHaveBeenLastCalledWith(content);
    });

    it('with both comments', () => {
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

      expect(up).toBeDefined();
      expect(down).toBeDefined();

      const upSql = vi.fn();

      expect(up({ sql: upSql })).not.toBeDefined();
      expect(upSql).toHaveBeenCalled();
      expect(upSql).toHaveBeenLastCalledWith(upMigration);

      const downSql = vi.fn();

      expect(down({ sql: downSql })).not.toBeDefined();
      expect(downSql).toHaveBeenCalled();
      expect(downSql).toHaveBeenLastCalledWith(downMigration);
    });

    it('with both comments in reverse order', () => {
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

      expect(up).toBeDefined();
      expect(down).toBeDefined();

      const upSql = vi.fn();

      expect(up({ sql: upSql })).not.toBeDefined();
      expect(upSql).toHaveBeenCalled();
      expect(upSql).toHaveBeenLastCalledWith(upMigration);

      const downSql = vi.fn();

      expect(down({ sql: downSql })).not.toBeDefined();
      expect(downSql).toHaveBeenCalled();
      expect(downSql).toHaveBeenLastCalledWith(downMigration);
    });

    it('with both comments with some chars added', () => {
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

      expect(up).toBeDefined();
      expect(down).toBeDefined();

      const upSql = vi.fn();

      expect(up({ sql: upSql })).not.toBeDefined();
      expect(upSql).toHaveBeenCalled();
      expect(upSql).toHaveBeenLastCalledWith(upMigration);

      const downSql = vi.fn();

      expect(down({ sql: downSql })).not.toBeDefined();
      expect(downSql).toHaveBeenCalled();
      expect(downSql).toHaveBeenLastCalledWith(downMigration);
    });
  });
});
