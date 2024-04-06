import { describe, expect, it } from 'vitest';
import { dropExtension } from '../../../src/operations/extensions';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('extensions', () => {
    describe('dropExtension', () => {
      const dropExtensionFn = dropExtension(options1);

      it('should return a function', () => {
        expect(dropExtensionFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropExtensionFn('hstore');

        expect(statement).toBeTypeOf('object');
        expect(statement).toStrictEqual(['DROP EXTENSION "hstore";']);
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropExtensionFn('hstore', {
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('object');
        expect(statement).toStrictEqual([
          'DROP EXTENSION IF EXISTS "hstore" CASCADE;',
        ]);
      });

      it('should return sql statement with array', () => {
        const statement = dropExtensionFn(['hstore', 'uuid-ossp']);

        expect(statement).toBeTypeOf('object');
        expect(statement).toStrictEqual([
          'DROP EXTENSION "hstore";',
          'DROP EXTENSION "uuid-ossp";',
        ]);
      });
    });
  });
});
