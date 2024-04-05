import { describe, expect, it } from 'vitest';
import type { RunnerOption } from '../../src';
import { getMigrationTableSchema } from '../../src/utils';

describe('utils', () => {
  describe('getMigrationTableSchema', () => {
    const defaults: RunnerOption = {
      databaseUrl: 'postgres://localhost:5432/db',
      dir: 'migrations',
      direction: 'up',
      migrationsTable: 'migrations',
    };

    it('should return custom migrations schema', () => {
      const actual = getMigrationTableSchema({
        ...defaults,
        migrationsSchema: 'myschema',
      });

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('myschema');
    });

    it('should fallback to schema', () => {
      const actual = getMigrationTableSchema({
        ...defaults,
        schema: 'myschema',
      });

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('myschema');
    });

    it('should fallback to first schema', () => {
      const actual = getMigrationTableSchema({
        ...defaults,
        schema: ['myschema1', 'myschema2'],
      });

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('myschema1');
    });

    it('should fallback to public on empty schemas', () => {
      const actual = getMigrationTableSchema({
        ...defaults,
        schema: [],
      });

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('public');
    });

    it('should be immutable', () => {
      const options: Readonly<RunnerOption> = Object.freeze({ ...defaults });
      const actual = getMigrationTableSchema(options);

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('public');
    });
  });
});
