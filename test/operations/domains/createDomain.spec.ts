import { describe, expect, it } from 'vitest';
import { PgType } from '../../../src';
import { createDomain } from '../../../src/operations/domains';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('domains', () => {
    describe('createDomain', () => {
      const createDomainFn = createDomain(options1);

      it('should return a function', () => {
        expect(createDomainFn).toBeTypeOf('function');
      });

      it('should return sql statement with string', () => {
        const statement = createDomainFn('us_postal_code', 'TEXT');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('CREATE DOMAIN "us_postal_code" AS TEXT;');
      });

      it('should return sql statement with PgType', () => {
        const statement = createDomainFn('us_postal_code', PgType.TEXT);

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('CREATE DOMAIN "us_postal_code" AS text;');
      });

      it('should return sql statement with schema', () => {
        const statement = createDomainFn(
          { schema: 'myschema', name: 'us_postal_code' },
          'TEXT'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE DOMAIN "myschema"."us_postal_code" AS TEXT;'
        );
      });

      it('should return sql statement with domainOptions collation and default', () => {
        const statement = createDomainFn('us_postal_code', 'TEXT', {
          collation: 'en_US',
          default: '12345',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE DOMAIN "us_postal_code" AS TEXT COLLATE en_US DEFAULT $pga$12345$pga$;'
        );
      });

      it('should return sql statement with domainOptions check', () => {
        const statement = createDomainFn('us_postal_code', 'TEXT', {
          check: "VALUE ~ '^d{5}$'",
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE DOMAIN "us_postal_code" AS TEXT CHECK (VALUE ~ \'^d{5}$\');'
        );
      });

      it('should return sql statement with domainOptions constraintName and notNull', () => {
        const statement = createDomainFn('us_postal_code', 'TEXT', {
          constraintName: 'us_postal_code_check',
          notNull: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE DOMAIN "us_postal_code" AS TEXT CONSTRAINT "us_postal_code_check" NOT NULL;'
        );
      });

      it('should throw when notNull and check are passed', () => {
        expect(() =>
          createDomainFn('us_postal_code', 'TEXT', {
            check: "VALUE ~ '^d{5}$'",
            notNull: true,
          })
        ).toThrow(
          new Error('"notNull" and "check" can\'t be specified together')
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createDomainFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createDomainFn.reverse('us_postal_code', 'TEXT');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP DOMAIN "us_postal_code";');
        });
      });
    });
  });
});
