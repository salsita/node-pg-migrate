import { describe, expect, it, vi } from 'vitest';
import { getActions } from '../src/sqlMigration';

describe('lib/sqlMigration', () => {
  describe('getActions', () => {
    it('without comments', () => {
      const content = 'SELECT 1 FROM something';
      const { up, down } = getActions(content);

      expect(up).to.exist;
      expect(down).to.be.false;

      const sql = vi.fn();

      expect(up({ sql })).to.not.exist;
      expect(sql).toHaveBeenCalled();
      expect(sql).toHaveBeenLastCalledWith(content.trim());
    });

    it('with up comment', () => {
      const content = `
-- Up Migration
SELECT 1 FROM something
`;
      const { up, down } = getActions(content);

      expect(up).to.exist;
      expect(down).to.be.false;

      const sql = vi.fn();

      expect(up({ sql })).to.not.exist;
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

      expect(up).to.exist;
      expect(down).to.exist;

      const upSql = vi.fn();

      expect(up({ sql: upSql })).to.not.exist;
      expect(upSql).toHaveBeenCalled();
      expect(upSql).toHaveBeenLastCalledWith(upMigration);

      const downSql = vi.fn();

      expect(down({ sql: downSql })).to.not.exist;
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

      expect(up).to.exist;
      expect(down).to.exist;

      const upSql = vi.fn();

      expect(up({ sql: upSql })).to.not.exist;
      expect(upSql).toHaveBeenCalled();
      expect(upSql).toHaveBeenLastCalledWith(upMigration);

      const downSql = vi.fn();

      expect(down({ sql: downSql })).to.not.exist;
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

      expect(up).to.exist;
      expect(down).to.exist;

      const upSql = vi.fn();

      expect(up({ sql: upSql })).to.not.exist;
      expect(upSql).toHaveBeenCalled();
      expect(upSql).toHaveBeenLastCalledWith(upMigration);

      const downSql = vi.fn();

      expect(down({ sql: downSql })).to.not.exist;
      expect(downSql).toHaveBeenCalled();
      expect(downSql).toHaveBeenLastCalledWith(downMigration);
    });
  });
});
