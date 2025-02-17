import { describe, expect, it } from 'vitest';
import { createSchemalize } from '../../src/utils';

describe('utils', () => {
  describe('createSchemalize', () => {
    it.each([
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ])('should return a function', (shouldDecamelize, shouldQuote) => {
      const actual = createSchemalize({
        shouldDecamelize,
        shouldQuote,
      });

      expect(actual).toBeTypeOf('function');
    });

    it('should decamelize and quote for string', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: true,
        shouldQuote: true,
      });

      const actual = schemalize('myTable');

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('"my_table"');
    });

    it('should decamelize and quote for schema', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: true,
        shouldQuote: true,
      });

      const actual = schemalize({ schema: 'mySchema', name: 'myTable' });

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('"my_schema"."my_table"');
    });

    it('should only decamelize for string', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: true,
        shouldQuote: false,
      });

      const actual = schemalize('myTable');

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('my_table');
    });

    it('should only decamelize for schema', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: true,
        shouldQuote: false,
      });

      const actual = schemalize({ schema: 'mySchema', name: 'myTable' });

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('my_schema.my_table');
    });

    it('should only quote for string', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: false,
        shouldQuote: true,
      });

      const actual = schemalize('myTable');

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('"myTable"');
    });

    it('should only quote for schema', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: false,
        shouldQuote: true,
      });

      const actual = schemalize({ schema: 'mySchema', name: 'myTable' });

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('"mySchema"."myTable"');
    });

    it('should not decamelize and quote for string', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: false,
        shouldQuote: false,
      });

      const actual = schemalize('myTable');

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('myTable');
    });

    it('should not decamelize and quote for schema', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: false,
        shouldQuote: false,
      });

      const actual = schemalize({ schema: 'mySchema', name: 'myTable' });

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('mySchema.myTable');
    });

    // TODO @Shinigami92 2024-04-03: Should this throw an error?
    it.each([
      [true, true, '""'],
      [true, false, ''],
      [false, true, '""'],
      [false, false, ''],
    ])(
      'should return empty string',
      (shouldDecamelize, shouldQuote, expected) => {
        const schemalize = createSchemalize({
          shouldDecamelize,
          shouldQuote,
        });

        const actual = schemalize('');

        expect(actual).toBeTypeOf('string');
        expect(actual).toBe(expected);
      }
    );

    it.each([
      [true, true, '"my_table"'],
      [true, false, 'my_table'],
      [false, true, '"myTable"'],
      [false, false, 'myTable'],
    ])('should accept only name', (shouldDecamelize, shouldQuote, expected) => {
      const schemalize = createSchemalize({
        shouldDecamelize,
        shouldQuote,
      });

      const actual = schemalize({ name: 'myTable' });

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe(expected);
    });
  });
});
