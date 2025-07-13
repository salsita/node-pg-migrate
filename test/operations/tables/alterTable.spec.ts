import { describe, expect, it } from 'vitest';
import { alterTable } from '../../../src/operations/tables';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('tables', () => {
    describe('alterTable', () => {
      const alterTableFn = alterTable(options1);

      it('should return a function', () => {
        expect(alterTableFn).toBeTypeOf('function');
      });

      it('should throw error when no table options are provided', () => {
        expect(() => alterTableFn('films', {})).toThrow(
          new Error('No table options provided for alterTable')
        );
      });

      it('should return sql statement with tableOptions', () => {
        const statement = alterTableFn('distributors', {
          levelSecurity: 'ENABLE',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "distributors"
    ENABLE ROW LEVEL SECURITY;`);
      });

      it('should generate SQL for SET LOGGED', () => {
        const statement = alterTableFn('my_table', {
          unlogged: false,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "my_table"
    SET LOGGED;`);
      });

      it('should generate SQL for SET UNLOGGED', () => {
        const statement = alterTableFn('my_table', {
          unlogged: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER TABLE "my_table"
    SET UNLOGGED;`);
      });
    });
  });
});
