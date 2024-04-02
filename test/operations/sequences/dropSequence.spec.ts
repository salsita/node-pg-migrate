import { describe, expect, it } from 'vitest';
import { dropSequence } from '../../../src/operations/sequences';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('sequences', () => {
    describe('dropSequence', () => {
      const dropSequenceFn = dropSequence(options1);

      it('should return a function', () => {
        expect(dropSequenceFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = dropSequenceFn('serial');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP SEQUENCE "serial";');
      });

      it('should return sql statement with dropOptions', () => {
        const statement = dropSequenceFn('serial', {
          ifExists: true,
          cascade: true,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe('DROP SEQUENCE IF EXISTS "serial" CASCADE;');
      });
    });
  });
});
