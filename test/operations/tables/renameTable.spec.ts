import { describe, expect, it } from 'vitest';
import { renameTable } from '../../../src/operations/tables';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('tables', () => {
    describe('renameTable', () => {
      const renameTableFn = renameTable(options1);

      it('should return a function', () => {
        expect(renameTableFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameTableFn('distributors', 'suppliers');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TABLE "distributors" RENAME TO "suppliers";'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = renameTableFn(
          { name: 'distributors', schema: 'myschema' },
          { name: 'suppliers', schema: 'myschema' }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TABLE "myschema"."distributors" RENAME TO "suppliers";'
        );
      });

      it.each([
        ['suppliers'],
        [{ name: 'suppliers' }],
        [{ name: 'suppliers', schema: 'myschema' }],
      ])('should preserve the schema when reversing to %j', (newName) => {
        expect(
          renameTableFn.reverse(
            { name: 'distributors', schema: 'myschema' },
            newName
          )
        ).toBe('ALTER TABLE "myschema"."suppliers" RENAME TO "distributors";');
      });

      it('should reject a change of schema in either direction', () => {
        const from = { name: 'distributors', schema: 'myschema' };
        const to = { name: 'suppliers', schema: 'other' };

        expect(() => renameTableFn(from, to)).toThrow('schema');
        expect(() => renameTableFn.reverse(from, to)).toThrow('schema');
        expect(() => renameTableFn('distributors', to)).toThrow('schema');
      });

      it('should escape schema and table names when reversing', () => {
        expect(
          renameTableFn.reverse(
            { name: 'old"table', schema: 'my"schema' },
            'new"table'
          )
        ).toBe('ALTER TABLE "my""schema"."new""table" RENAME TO "old""table";');
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameTableFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameTableFn.reverse('distributors', 'suppliers');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER TABLE "suppliers" RENAME TO "distributors";'
          );
        });
      });
    });
  });
});
