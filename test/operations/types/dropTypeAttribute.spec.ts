import { describe, expect, it } from 'vitest';
import { dropTypeAttribute } from '../../../src/operations/types';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('types', () => {
    describe('dropTypeAttribute', () => {
      const dropTypeAttributeFn = dropTypeAttribute(options1);

      it('should return a function', () => {
        expect(dropTypeAttributeFn).toBeTypeOf('function');
      });

      it.each([undefined, {}, { ifExists: false }])(
        'should return sql statement without IF EXISTS for %j',
        (options) => {
          const statement = dropTypeAttributeFn('compfoo', 'bar', options);

          expect(statement).toBe('ALTER TYPE "compfoo" DROP ATTRIBUTE "bar";');
        }
      );

      it('should return sql statement with dropOptions', () => {
        const statement = dropTypeAttributeFn('compfoo', 'bar', {
          ifExists: true,
        });

        expect(statement).toBe(
          'ALTER TYPE "compfoo" DROP ATTRIBUTE IF EXISTS "bar";'
        );
      });

      it('should qualify the schema and escape identifiers without IF EXISTS', () => {
        const statement = dropTypeAttributeFn(
          { schema: 'my"schema', name: 'comp"foo' },
          'b"ar'
        );

        expect(statement).toBe(
          'ALTER TYPE "my""schema"."comp""foo" DROP ATTRIBUTE "b""ar";'
        );
      });

      it('should qualify the schema and escape identifiers with IF EXISTS', () => {
        const statement = dropTypeAttributeFn(
          { schema: 'my"schema', name: 'comp"foo' },
          'b"ar',
          { ifExists: true }
        );

        expect(statement).toBe(
          'ALTER TYPE "my""schema"."comp""foo" DROP ATTRIBUTE IF EXISTS "b""ar";'
        );
      });
    });
  });
});
