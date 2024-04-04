import { describe, expect, it } from 'vitest';
import { getSchemas } from '../../src/utils';

describe('utils', () => {
  describe('getSchemas', () => {
    it('should return public as default', () => {
      const actual = getSchemas();

      expect(actual).toBeTypeOf('object');
      expect(actual).toStrictEqual(['public']);
    });

    it('should return custom schema', () => {
      const actual = getSchemas('myschema');

      expect(actual).toBeTypeOf('object');
      expect(actual).toStrictEqual(['myschema']);
    });

    it('should return cleaned schemas', () => {
      const actual = getSchemas(['myschema1', '', 'myschema2']);

      expect(actual).toBeTypeOf('object');
      expect(actual).toHaveLength(2);
      expect(actual).toStrictEqual(['myschema1', 'myschema2']);
    });

    it('should return public on empty string', () => {
      const actual = getSchemas('');

      expect(actual).toBeTypeOf('object');
      expect(actual).toStrictEqual(['public']);
    });

    it('should be immutable', () => {
      const schemas: ReadonlyArray<string> = Object.freeze(['myschema']);
      const actual = getSchemas(schemas);

      expect(actual).toBeTypeOf('object');
      expect(actual).toStrictEqual(['myschema']);
    });
  });
});
