import { describe, expect, it } from 'vitest';
import { renameOperatorClass } from '../../../src/operations/operators';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('operators', () => {
    describe('renameOperatorClass', () => {
      const renameOperatorClassFn = renameOperatorClass(options1);

      it('should return a function', () => {
        expect(renameOperatorClassFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameOperatorClassFn(
          'gist__int_ops',
          'gist',
          'gist__int_ops_new'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER OPERATOR CLASS "gist__int_ops" USING gist RENAME TO "gist__int_ops_new";'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = renameOperatorClassFn(
          { name: 'gist__int_ops', schema: 'myschema' },
          'gist',
          { name: 'gist__int_ops_new', schema: 'myschema' }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER OPERATOR CLASS "myschema"."gist__int_ops" USING gist RENAME TO "gist__int_ops_new";'
        );
      });

      describe.each(['up', 'down'] as const)('%s identity', (direction) => {
        const operation =
          direction === 'down'
            ? renameOperatorClassFn.reverse
            : renameOperatorClassFn;

        it.each(['btree', 'hash', '"customMethod"'])(
          'preserves access method %s',
          (method) => {
            expect(
              operation({ schema: 'app', name: 'old' }, method, {
                schema: 'app',
                name: 'new',
              })
            ).toBe(
              direction === 'down'
                ? `ALTER OPERATOR CLASS "app"."new" USING ${method} RENAME TO "old";`
                : `ALTER OPERATOR CLASS "app"."old" USING ${method} RENAME TO "new";`
            );
          }
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameOperatorClassFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameOperatorClassFn.reverse(
            'gist__int_ops',
            'gist',
            'gist__int_ops_new'
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER OPERATOR CLASS "gist__int_ops_new" USING gist RENAME TO "gist__int_ops";'
          );
        });
      });
    });
  });
});
