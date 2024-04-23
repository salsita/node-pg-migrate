import { describe, expect, it } from 'vitest';
import { createExtension } from '../../../src/operations/extensions';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('extensions', () => {
    describe('createExtension', () => {
      const createExtensionFn = createExtension(options1);

      it('should return a function', () => {
        expect(createExtensionFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = createExtensionFn('hstore');

        expect(statement).toBeTypeOf('object');
        expect(statement).toStrictEqual(['CREATE EXTENSION "hstore";']);
      });

      it('should return sql statement with dropOptions', () => {
        const statement = createExtensionFn('hstore', {
          ifNotExists: true,
          schema: 'my_schema',
        });

        expect(statement).toBeTypeOf('object');
        expect(statement).toStrictEqual([
          'CREATE EXTENSION IF NOT EXISTS "hstore" SCHEMA "my_schema";',
        ]);
      });

      it('should return sql statement with array', () => {
        const statement = createExtensionFn(['hstore', 'uuid-ossp']);

        expect(statement).toBeTypeOf('object');
        expect(statement).toStrictEqual([
          'CREATE EXTENSION "hstore";',
          'CREATE EXTENSION "uuid-ossp";',
        ]);
      });
    });
  });
});
