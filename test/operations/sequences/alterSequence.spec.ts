import { describe, expect, it } from 'vitest';
import { alterSequence } from '../../../src/operations/sequences';
import { options1, options1Pretty } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('sequences', () => {
    describe('alterSequence', () => {
      const alterSequenceFn = alterSequence(options1);

      it('should return a function', () => {
        expect(alterSequenceFn).toBeTypeOf('function');
      });

      it('should throw error when no sequence options are provided', () => {
        expect(() => alterSequenceFn('serial', {})).toThrow(
          new Error('No sequence options provided for alterSequence')
        );
      });

      it('should return sql statement with sequenceOptions', () => {
        const statement = alterSequenceFn('serial', {
          restart: 105,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER SEQUENCE "serial" RESTART WITH 105;`);
      });

      it('should format the statement across multiple lines when pretty is enabled', () => {
        const statement = alterSequence(options1Pretty)('serial', {
          restart: 105,
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`ALTER SEQUENCE "serial"
  RESTART WITH 105;`);
      });
    });
  });
});
