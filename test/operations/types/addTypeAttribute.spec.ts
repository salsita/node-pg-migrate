import { describe, expect, it } from 'vitest';
import { PgType } from '../../../src';
import { addTypeAttribute } from '../../../src/operations/types';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('types', () => {
    describe('addTypeAttribute', () => {
      const addTypeAttributeFn = addTypeAttribute(options1);

      it('should return a function', () => {
        expect(addTypeAttributeFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = addTypeAttributeFn('compfoo', 'f3', PgType.INT);

        expect(statement).toBe(
          'ALTER TYPE "compfoo" ADD ATTRIBUTE "f3" integer;'
        );
      });

      it('should ignore attributeOptions, because they only affect the reverse', () => {
        const statement = addTypeAttributeFn('compfoo', 'f3', PgType.INT, {
          ifExists: true,
        });

        expect(statement).toBe(
          'ALTER TYPE "compfoo" ADD ATTRIBUTE "f3" integer;'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = addTypeAttributeFn(
          { name: 'compfoo', schema: 'myschema' },
          'f3',
          'int'
        );

        expect(statement).toBe(
          'ALTER TYPE "myschema"."compfoo" ADD ATTRIBUTE "f3" integer;'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(addTypeAttributeFn.reverse).toBeTypeOf('function');
        });

        it.each([undefined, {}, { ifExists: false }])(
          'should return sql statement without IF EXISTS for %j',
          (options) => {
            const statement = addTypeAttributeFn.reverse(
              'compfoo',
              'f3',
              PgType.INT,
              options
            );

            expect(statement).toBe('ALTER TYPE "compfoo" DROP ATTRIBUTE "f3";');
          }
        );

        it('should return sql statement with attributeOptions', () => {
          const statement = addTypeAttributeFn.reverse(
            'compfoo',
            'f3',
            PgType.INT,
            { ifExists: true }
          );

          expect(statement).toBe(
            'ALTER TYPE "compfoo" DROP ATTRIBUTE IF EXISTS "f3";'
          );
        });

        it('should qualify the schema and escape identifiers without IF EXISTS', () => {
          const statement = addTypeAttributeFn.reverse(
            { schema: 'my"schema', name: 'comp"foo' },
            'f"3',
            PgType.INT
          );

          expect(statement).toBe(
            'ALTER TYPE "my""schema"."comp""foo" DROP ATTRIBUTE "f""3";'
          );
        });

        it('should qualify the schema and escape identifiers with IF EXISTS', () => {
          const statement = addTypeAttributeFn.reverse(
            { schema: 'my"schema', name: 'comp"foo' },
            'f"3',
            PgType.INT,
            { ifExists: true }
          );

          expect(statement).toBe(
            'ALTER TYPE "my""schema"."comp""foo" DROP ATTRIBUTE IF EXISTS "f""3";'
          );
        });
      });
    });
  });
});
