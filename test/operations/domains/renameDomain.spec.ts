import { describe, expect, it } from 'vitest';
import { renameDomain } from '../../../src/operations/domains';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('domains', () => {
    describe('renameDomain', () => {
      const renameDomainFn = renameDomain(options1);

      it('should return a function', () => {
        expect(renameDomainFn).toBeTypeOf('function');
      });

      it('should return sql statement with domainOptions default', () => {
        const statement = renameDomainFn('zipcode', 'zip_code');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('ALTER DOMAIN "zipcode" RENAME TO "zip_code";');
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameDomainFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameDomainFn.reverse('zipcode', 'zip_code');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER DOMAIN "zip_code" RENAME TO "zipcode";'
          );
        });
      });
    });
  });
});
