import { describe, expect, it } from 'vitest';
import { createOperatorClass } from '../../../src/operations/operators';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('operators', () => {
    describe('createOperatorClass', () => {
      const createOperatorClassFn = createOperatorClass(options1);

      it('should return a function', () => {
        expect(createOperatorClassFn).toBeTypeOf('function');
      });

      it.todo('should return sql statement', () => {
        const statement = createOperatorClassFn(
          'gist__int_ops',
          '_int4',
          'gist',
          [
            {
              name: '&&',
              number: 3,
              type: 'operator',
            },
          ],
          {
            default: true,
          }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE OPERATOR CLASS "gist__int_ops" DEFAULT FOR TYPE "_int4" USING "gist"  AS
  FUNCTION 3 "&&"();`
        );
      });

      it.todo('should return sql statement with operatorOptions', () => {});

      it.todo('should return sql statement with schema', () => {});

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createOperatorClassFn.reverse).toBeTypeOf('function');
        });

        it.todo('should return sql statement', () => {});
      });
    });
  });
});
