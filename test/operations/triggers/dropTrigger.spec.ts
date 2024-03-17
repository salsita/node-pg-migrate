import { describe, expect, it } from 'vitest';
import { dropTrigger } from '../../../src/operations/triggers';
import { options1 } from '../../utils';

describe('operations', () => {
  describe('triggers', () => {
    describe('dropTrigger', () => {
      const dropTriggerFn = dropTrigger(options1);

      it('should return a function', () => {
        expect(dropTriggerFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropTriggerFn('films', 'if_dist_exists');

        expect(statement).toBeTypeOf('string');
        expect(statement).toStrictEqual(
          'DROP TRIGGER "if_dist_exists" ON "films";'
        );
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropTriggerFn('films', 'if_dist_exists', {
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toStrictEqual(
          'DROP TRIGGER IF EXISTS "if_dist_exists" ON "films" CASCADE;'
        );
      });
    });
  });
});
