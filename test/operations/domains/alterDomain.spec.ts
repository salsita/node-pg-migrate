import { describe, expect, it } from 'vitest';
import { alterDomain } from '../../../src/operations/domains';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('domains', () => {
    describe('alterDomain', () => {
      const alterDomainFn = alterDomain(options1);

      it('should return a function', () => {
        expect(alterDomainFn).toBeTypeOf('function');
      });

      it('should return sql statement with domainOptions default', () => {
        const statement = alterDomainFn('zipcode', {
          default: '12345',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER DOMAIN "zipcode" SET DEFAULT $pga$12345$pga$;'
        );
      });

      it('should return sql statement with domainOptions default null', () => {
        const statement = alterDomainFn('zipcode', {
          default: null,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('ALTER DOMAIN "zipcode" DROP DEFAULT;');
      });

      it('should return sql statement with domainOptions notNull', () => {
        const statement = alterDomainFn('zipcode', {
          notNull: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('ALTER DOMAIN "zipcode" SET NOT NULL;');
      });

      it('should return sql statement with domainOptions allowNull', () => {
        const statement = alterDomainFn('zipcode', {
          allowNull: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('ALTER DOMAIN "zipcode" DROP NOT NULL;');
      });

      it('should return sql statement with domainOptions check', () => {
        const statement = alterDomainFn('zipcode', {
          check: 'char_length(VALUE) = 5',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER DOMAIN "zipcode" CHECK (char_length(VALUE) = 5);'
        );
      });

      it('should return sql statement with domainOptions check and constraintName', () => {
        const statement = alterDomainFn('zipcode', {
          check: 'char_length(VALUE) = 5',
          constraintName: 'zipchk',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER DOMAIN "zipcode" CONSTRAINT "zipchk" CHECK (char_length(VALUE) = 5);'
        );
      });
    });
  });
});
