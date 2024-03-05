import { describe, expect, it } from 'vitest';
import { PgType } from '../../src';
import { createDomain } from '../../src/operations/domains';
import { options1 } from '../utils';

describe('operations', () => {
  describe('createDomain', () => {
    it('should return a function', () => {
      const createDomainFn = createDomain(options1);

      expect(createDomainFn).toBeTypeOf('function');
    });

    it('should return sql statement with string', () => {
      const createDomainFn = createDomain(options1);

      const statement = createDomainFn('us_postal_code', 'TEXT');

      expect(statement).toBeTypeOf('string');
      expect(statement).toBe('CREATE DOMAIN "us_postal_code" AS TEXT;');
    });

    it('should return sql statement with PgType', () => {
      const createDomainFn = createDomain(options1);

      const statement = createDomainFn('us_postal_code', PgType.TEXT);

      expect(statement).toBeTypeOf('string');
      expect(statement).toBe('CREATE DOMAIN "us_postal_code" AS text;');
    });

    it('should return sql statement with string', () => {
      const createDomainFn = createDomain(options1);

      const statement = createDomainFn(
        { schema: 'myschema', name: 'us_postal_code' },
        'TEXT'
      );

      expect(statement).toBeTypeOf('string');
      expect(statement).toBe(
        'CREATE DOMAIN "myschema"."us_postal_code" AS TEXT;'
      );
    });

    it('should return sql statement with domainOptions', () => {
      const createDomainFn = createDomain(options1);

      const statement = createDomainFn('us_postal_code', 'TEXT', {
        collation: 'en_US',
        default: '12345',
        constraintName: 'us_postal_code_check',
      });

      expect(statement).toBeTypeOf('string');
      expect(statement).toBe(
        'CREATE DOMAIN "us_postal_code" AS TEXT COLLATE en_US DEFAULT $pga$12345$pga$;'
      );
    });

    it('should return sql statement with domainOptions.check', () => {
      const createDomainFn = createDomain(options1);

      const statement = createDomainFn('us_postal_code', 'TEXT', {
        check: "VALUE ~ '^d{5}$'",
      });

      expect(statement).toBeTypeOf('string');
      expect(statement).toBe(
        'CREATE DOMAIN "us_postal_code" AS TEXT CHECK (VALUE ~ \'^d{5}$\');'
      );
    });

    it('should contain a reverse function', () => {
      const createDomainFn = createDomain(options1);

      expect(createDomainFn.reverse).toBeTypeOf('function');
    });

    it('should throw when notNull and check are passed', () => {
      const createDomainFn = createDomain(options1);

      expect(() =>
        createDomainFn('us_postal_code', 'TEXT', {
          check: "VALUE ~ '^d{5}$'",
          notNull: true,
        })
      ).toThrow(
        new Error('"notNull" and "check" can\'t be specified together')
      );
    });
  });
});
