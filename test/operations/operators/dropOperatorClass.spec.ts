import { describe, expect, it } from 'vitest';
import { dropOperatorClass } from '../../../src/operations/operators';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('operators', () => {
    describe('dropOperatorClass', () => {
      const dropOperatorClassFn = dropOperatorClass(options1);

      it('should return a function', () => {
        expect(dropOperatorClassFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropOperatorClassFn('widget_ops', 'btree');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP OPERATOR CLASS "widget_ops" USING btree;');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropOperatorClassFn('widget_ops', 'btree', {
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'DROP OPERATOR CLASS IF EXISTS "widget_ops" USING btree CASCADE;'
        );
      });
      it('should return sql statement with schema in index method (object bug)', () => {
        const statement = dropOperatorClassFn('widget_ops', { name: 'btree', schema: 'myschema' });
        expect(statement).toBe('DROP OPERATOR CLASS "widget_ops" USING "myschema"."btree";');
      });
    });
  });
});
