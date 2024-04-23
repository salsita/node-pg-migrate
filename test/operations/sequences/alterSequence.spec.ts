import { describe, expect, it } from 'vitest';
import { alterSequence } from '../../../src/operations/sequences';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('sequences', () => {
    describe('alterSequence', () => {
      const alterSequenceFn = alterSequence(options1);

      it('should return a function', () => {
        expect(alterSequenceFn).toBeTypeOf('function');
      });

      // TODO @Shinigami92 2024-03-11: This should throw an error
      it('should return sql statement', () => {
        const statement = alterSequenceFn('serial', {});

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER SEQUENCE "serial"
  ;`);
      });

      it('should return sql statement with sequenceOptions', () => {
        const statement = alterSequenceFn('serial', {
          restart: 105,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER SEQUENCE "serial"
  RESTART WITH 105;`);
      });
    });
  });
});
