import { describe, expect, it } from 'vitest';
import { dropDomain } from '../../../src/operations/domains';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('domains', () => {
    describe('dropDomain', () => {
      const dropDomainFn = dropDomain(options1);

      it('should return a function', () => {
        expect(dropDomainFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropDomainFn('us_postal_code');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP DOMAIN "us_postal_code";');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropDomainFn('us_postal_code', {
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'DROP DOMAIN IF EXISTS "us_postal_code" CASCADE;'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = dropDomainFn({
          schema: 'myschema',
          name: 'us_postal_code',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP DOMAIN "myschema"."us_postal_code";');
      });
    });
  });
});
