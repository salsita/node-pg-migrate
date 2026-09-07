import { describe, expect, it } from 'vitest';
import { renameDomain } from '../../../src/operations/domains';
import { options1, options2 } from '../../presetMigrationOptions';

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

      it.each([
        ['new'],
        [{ name: 'new' }],
        [{ schema: 'app', name: 'new' }],
        [{ schema: undefined, name: 'new' }],
      ])('should preserve the source schema with %j', (destination) => {
        const source = { schema: 'app', name: 'old' };
        expect(renameDomainFn(source, destination)).toBe(
          'ALTER DOMAIN "app"."old" RENAME TO "new";'
        );
        expect(renameDomainFn.reverse(source, destination)).toBe(
          'ALTER DOMAIN "app"."new" RENAME TO "old";'
        );
      });

      it.each([undefined, ''])(
        'should keep matching %j schemas unqualified',
        (schema) => {
          const source = { schema, name: 'old' };
          const destination = { schema, name: 'new' };
          expect(renameDomainFn(source, destination)).toBe(
            'ALTER DOMAIN "old" RENAME TO "new";'
          );
          expect(renameDomainFn.reverse(source, destination)).toBe(
            'ALTER DOMAIN "new" RENAME TO "old";'
          );
        }
      );

      it.each([
        [
          { schema: 'app', name: 'old' },
          { schema: 'other', name: 'new' },
        ],
        ['old', { schema: 'app', name: 'new' }],
        [
          { schema: 'app', name: 'old' },
          { schema: '', name: 'new' },
        ],
        ['old', { schema: '', name: 'new' }],
      ])(
        'should reject incompatible explicit schemas: %j -> %j',
        (source, destination) => {
          const error = new Error(
            'renameDomain cannot change the schema of a domain'
          );
          expect(() => renameDomainFn(source, destination)).toThrow(error);
          expect(() => renameDomainFn.reverse(source, destination)).toThrow(
            error
          );
        }
      );

      it('should escape schema and object identifiers in both directions', () => {
        const source = { schema: 'my"schema', name: 'old"name' };
        expect(renameDomainFn(source, 'new"name')).toBe(
          'ALTER DOMAIN "my""schema"."old""name" RENAME TO "new""name";'
        );
        expect(renameDomainFn.reverse(source, 'new"name')).toBe(
          'ALTER DOMAIN "my""schema"."new""name" RENAME TO "old""name";'
        );
      });

      it('should decamelize both directions and compare schemas before transformation', () => {
        const rename = renameDomain(options2);
        const source = { schema: 'appSchema', name: 'oldName' };
        const destination = { schema: 'appSchema', name: 'newName' };
        expect(rename(source, destination)).toBe(
          'ALTER DOMAIN "app_schema"."old_name" RENAME TO "new_name";'
        );
        expect(rename.reverse(source, destination)).toBe(
          'ALTER DOMAIN "app_schema"."new_name" RENAME TO "old_name";'
        );
        const mismatched = { schema: 'app_schema', name: 'newName' };
        const error = new Error(
          'renameDomain cannot change the schema of a domain'
        );
        expect(() => rename(source, mismatched)).toThrow(error);
        expect(() => rename.reverse(source, mismatched)).toThrow(error);
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
