import { describe, expect, it } from 'vitest';
import type { ColumnDefinitions } from '../../src/operations/tables';
import { applyType, applyTypeAdapters } from '../../src/utils';

describe('utils', () => {
  describe('applyTypeAdapters', () => {
    it.each([
      ['int', 'integer'],
      ['string', 'text'],
      ['float', 'real'],
      ['double', 'double precision'],
      ['datetime', 'timestamp'],
      ['bool', 'boolean'],
    ])('should map %s to %s', (type, mappedType) => {
      const actual = applyTypeAdapters(type);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe(mappedType);
    });

    it('should map custom value', () => {
      const actual = applyTypeAdapters('custom');

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('custom');
    });
  });

  describe('applyType', () => {
    it('should convert string', () => {
      const type = 'type';

      const actual = applyType(type);

      expect(actual).toBeTypeOf('object');
      expect(actual).toStrictEqual({ type });
    });

    it('should apply id shorthand', () => {
      const actual = applyType('id');

      expect(actual).toBeTypeOf('object');
      expect(actual).toStrictEqual({ type: 'serial', primaryKey: true });
    });

    it('should apply shorthand', () => {
      const shorthandName = 'type';
      const shorthandDefinition = { type: 'integer', defaultValue: 1 };

      const actual = applyType(shorthandName, {
        [shorthandName]: shorthandDefinition,
      });

      expect(actual).toBeTypeOf('object');
      expect(actual).toStrictEqual(shorthandDefinition);
    });

    it('should apply recursive shorthand', () => {
      const shorthands: ColumnDefinitions = {
        ref: { type: 'integer', onDelete: 'CASCADE' },
        user: { type: 'ref', references: 'users' },
      };

      const actual = applyType('user', shorthands);

      expect(actual).toBeTypeOf('object');
      expect(actual).toStrictEqual({
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

      expect(() => applyType('user', shorthands)).toThrow(
        new Error('Shorthands contain cyclic dependency: user, ref, user')
      );
    });
  });
});
