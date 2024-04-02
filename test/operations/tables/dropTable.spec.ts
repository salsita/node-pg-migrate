import { describe, expect, it } from 'vitest';
import { dropTable } from '../../../src/operations/tables';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('tables', () => {
    describe('dropTable', () => {
      const dropTableFn = dropTable(options1);

      it('should return a function', () => {
        expect(dropTableFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropTableFn('films');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP TABLE "films";');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropTableFn('films', {
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP TABLE IF EXISTS "films" CASCADE;');
      });
    });
  });
});
