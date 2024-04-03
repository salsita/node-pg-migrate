import { describe, expect, it } from 'vitest';
import { createSequence } from '../../../src/operations/sequences';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('sequences', () => {
    describe('createSequence', () => {
      const createSequenceFn = createSequence(options1);

      it('should return a function', () => {
        expect(createSequenceFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = createSequenceFn('serial');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`CREATE SEQUENCE "serial"
  ;`);
      });

      it('should return sql statement with sequenceOptions', () => {
        const statement = createSequenceFn('serial', {
          temporary: true,
          ifNotExists: true,
          type: 'bigint',
          increment: 2,
          minvalue: 0,
          maxvalue: 1000,
          start: 1,
          cache: 1,
          cycle: true,
          owner: 'mytable.mycol',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE TEMPORARY SEQUENCE IF NOT EXISTS "serial"
  AS bigint
  INCREMENT BY 2
  MAXVALUE 1000
  START WITH 1
  CACHE 1
  CYCLE
  OWNED BY mytable.mycol;`
        );
      });

      it('should return sql statement with schema', () => {
        const statement = createSequenceFn({
          name: 'serial',
          schema: 'myschema',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE SEQUENCE "myschema"."serial"
  ;`
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createSequenceFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createSequenceFn.reverse('serial');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP SEQUENCE "serial";');
        });
      });
    });
  });
});
