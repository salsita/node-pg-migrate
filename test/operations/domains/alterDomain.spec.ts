import { describe, expect, it, vi } from 'vitest';
import { alterDomain } from '../../../src/operations/domains';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('domains', () => {
    describe('alterDomain', () => {
      const alterDomainFn = alterDomain(options1);

      it.each([
        [{}, '', undefined],
        [{ notNull: undefined, allowNull: undefined }, '', undefined],
        [{ notNull: true }, 'SET NOT NULL', undefined],
        [{ notNull: false }, 'DROP NOT NULL', undefined],
        [{ allowNull: true }, 'DROP NOT NULL', undefined],
        [
          { allowNull: false },
          '',
          'allowNull: false does not set NOT NULL. Use notNull: true to disallow null values.',
        ],
        [{ notNull: true, allowNull: false }, 'SET NOT NULL', undefined],
        [{ notNull: false, allowNull: true }, 'DROP NOT NULL', undefined],
        [
          { notNull: true, allowNull: true },
          'SET NOT NULL',
          'notNull: true conflicts with allowNull: true. notNull takes precedence.',
        ],
        [
          { notNull: false, allowNull: false },
          'DROP NOT NULL',
          'notNull: false conflicts with allowNull: false. notNull takes precedence; NOT NULL will be dropped.',
        ],
      ] as const)(
        'preserves nullability SQL and warns for ambiguous options: %j',
        (options, action, warning) => {
          const warn = vi.fn<(message: string) => void>();
          const statement = alterDomain({
            ...options1,
            logger: { ...console, warn },
          })({ schema: 'app', name: 'zip"code' }, options);

          expect(statement).toBe(
            action ? `ALTER DOMAIN "app"."zip""code" ${action};` : ';'
          );
          expect(warn.mock.calls).toEqual(
            warning ? [[`alterDomain "app"."zip""code": ${warning}`]] : []
          );
        }
      );

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
          'ALTER DOMAIN "zipcode" ADD CHECK (char_length(VALUE) = 5);'
        );
      });

      it('should return sql statement with domainOptions check and constraintName', () => {
        const statement = alterDomainFn('zipcode', {
          check: 'char_length(VALUE) = 5',
          constraintName: 'zipchk',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER DOMAIN "zipcode" ADD CONSTRAINT "zipchk" CHECK (char_length(VALUE) = 5);'
        );
      });
    });
  });
});
