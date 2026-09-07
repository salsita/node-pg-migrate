import { describe, expect, it } from 'vitest';
import { PgType } from '../../../src';
import { createType } from '../../../src/operations/types';
import { options1, options1Pretty } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('types', () => {
    describe('createType', () => {
      const createTypeFn = createType(options1);

      it('should return a function', () => {
        expect(createTypeFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = createTypeFn('compfoo', {
          f1: 'int',
          f2: PgType.TEXT,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE TYPE "compfoo" AS ("f1" integer, "f2" text);`
        );
      });

      it('should format the statement across multiple lines when pretty is enabled', () => {
        const statement = createType(options1Pretty)('compfoo', {
          f1: 'int',
          f2: PgType.TEXT,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`CREATE TYPE "compfoo" AS (
"f1" integer,
"f2" text
);`);
      });

      it('should ignore typeOptions, because they only affect the reverse', () => {
        const statement = createTypeFn(
          'compfoo',
          { f1: 'int', f2: PgType.TEXT },
          { ifExists: true, cascade: true }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE TYPE "compfoo" AS ("f1" integer, "f2" text);`
        );
      });

      it('should return sql statement with schema', () => {
        const statement = createTypeFn(
          {
            name: 'box',
            schema: 'myschema',
          },
          ['cstring']
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE TYPE "myschema"."box" AS ENUM ($pga$cstring$pga$);'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createTypeFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createTypeFn.reverse('compfoo', {
            f1: 'int',
            f2: PgType.TEXT,
          });

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP TYPE "compfoo";');
        });

        it('should return sql statement with typeOptions', () => {
          const statement = createTypeFn.reverse(
            'compfoo',
            { f1: 'int', f2: PgType.TEXT },
            { ifExists: true, cascade: true }
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP TYPE IF EXISTS "compfoo" CASCADE;');
        });

        it('should return sql statement with typeOptions for an enum', () => {
          const statement = createTypeFn.reverse('myenum', ['a', 'b'], {
            ifExists: true,
          });

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP TYPE IF EXISTS "myenum";');
        });
      });
    });
  });
});
