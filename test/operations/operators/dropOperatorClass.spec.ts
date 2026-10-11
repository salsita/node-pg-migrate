import { describe, expect, it } from 'vitest';
import { dropOperatorClass } from '../../../src/operations/operators';
import { options1, options2 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('operators', () => {
    describe('dropOperatorClass', () => {
      const dropOperatorClassFn = dropOperatorClass(options1);

      it.each([false, true])(
        'should preserve explicit access-method SQL (decamelize: %s)',
        (shouldDecamelize) => {
          const mOptions = shouldDecamelize ? options2 : options1;
          const drop = dropOperatorClass(mOptions);

          expect(drop('class_name', 'myMethod')).toBe(
            'DROP OPERATOR CLASS "class_name" USING myMethod;'
          );
          expect(drop('class_name', 'my_method')).toBe(
            'DROP OPERATOR CLASS "class_name" USING my_method;'
          );
          expect(drop('class_name', 'BTREE')).toBe(
            'DROP OPERATOR CLASS "class_name" USING BTREE;'
          );
          expect(drop('class_name', '"myMethod"')).toBe(
            'DROP OPERATOR CLASS "class_name" USING "myMethod";'
          );
          expect(drop('class_name', '"my""Method"')).toBe(
            'DROP OPERATOR CLASS "class_name" USING "my""Method";'
          );
        }
      );

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
    });
  });
});
