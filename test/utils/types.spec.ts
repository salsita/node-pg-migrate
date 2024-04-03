import { describe, expect, it } from 'vitest';
import type { ColumnDefinitions } from '../../src/operations/tablesTypes';
import { applyType } from '../../src/utils';

describe('utils', () => {
  describe('applyType', () => {
    it('should convert string', () => {
      const type = 'type';

      expect(applyType(type)).toEqual({ type });
    });

    it('should apply id shorthand', () => {
      expect(applyType('id')).toEqual({ type: 'serial', primaryKey: true });
    });

    it('should apply shorthand', () => {
      const shorthandName = 'type';
      const shorthandDefinition = { type: 'integer', defaultValue: 1 };

      expect(
        applyType(shorthandName, { [shorthandName]: shorthandDefinition })
      ).toEqual(shorthandDefinition);
    });

    it('should apply recursive shorthand', () => {
      const shorthands: ColumnDefinitions = {
        ref: { type: 'integer', onDelete: 'CASCADE' },
        user: { type: 'ref', references: 'users' },
      };

      expect(applyType('user', shorthands)).toEqual({
        type: 'integer',
        onDelete: 'CASCADE',
        references: 'users',
      });
    });

    it('should detect cycle in recursive shorthand', () => {
      const shorthands: ColumnDefinitions = {
        ref: { type: 'user', onDelete: 'CASCADE' },
        user: { type: 'ref', references: 'users' },
      };

      expect(() => applyType('user', shorthands)).toThrow();
    });
  });
});
