import { describe, expect, it } from 'vitest';
import { renameTrigger } from '../../../src/operations/triggers';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('triggers', () => {
    describe('renameTrigger', () => {
      const renameTriggerFn = renameTrigger(options1);

      it('should return a function', () => {
        expect(renameTriggerFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = renameTriggerFn('emp', 'emp_stamp', 'emp_track_chgs');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TRIGGER "emp_stamp" ON "emp" RENAME TO "emp_track_chgs";'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = renameTriggerFn(
          { name: 'emp', schema: 'myschema' },
          'emp_stamp',
          'emp_track_chgs'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER TRIGGER "emp_stamp" ON "myschema"."emp" RENAME TO "emp_track_chgs";'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(renameTriggerFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = renameTriggerFn.reverse(
            'emp',
            'emp_stamp',
            'emp_track_chgs'
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe(
            'ALTER TRIGGER "emp_track_chgs" ON "emp" RENAME TO "emp_stamp";'
          );
        });
      });
    });
  });
});
