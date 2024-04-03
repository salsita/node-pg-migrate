import { describe, expect, it } from 'vitest';
import { renameSequence } from '../../../src/operations/sequences';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('sequences', () => {
    describe('renameSequence', () => {
      const renameSequenceFn = renameSequence(options1);

      it('should return a function', () => {
        expect(renameSequenceFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameSequenceFn('serial', 'serial2');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('ALTER SEQUENCE "serial" RENAME TO "serial2";');
      });

      it('should return sql statement with schema', () => {
        const statement = renameSequenceFn(
          { name: 'serial', schema: 'myschema' },
          { name: 'serial2', schema: 'myschema' }
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER SEQUENCE "myschema"."serial" RENAME TO "myschema"."serial2";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameSequenceFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameSequenceFn.reverse('serial', 'serial2');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER SEQUENCE "serial2" RENAME TO "serial";'
          );
        });
      });
    });
  });
});
