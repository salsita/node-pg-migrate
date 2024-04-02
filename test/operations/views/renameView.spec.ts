import { describe, expect, it } from 'vitest';
import { renameView } from '../../../src/operations/views';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('views', () => {
    describe('renameView', () => {
      const renameViewFn = renameView(options1);

      it('should return a function', () => {
        expect(renameViewFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameViewFn('foo', 'bar');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('ALTER VIEW "foo" RENAME TO "bar";');
      });

      it('should return sql statement with schema', () => {
        const statement = renameViewFn(
          { name: 'foo', schema: 'myschema' },
          { name: 'bar', schema: 'myschema' }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER VIEW "myschema"."foo" RENAME TO "myschema"."bar";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameViewFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameViewFn.reverse('foo', 'bar');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('ALTER VIEW "bar" RENAME TO "foo";');
        });
      });
    });
  });
});
