import { describe, expect, it } from 'vitest';
import { createTrigger } from '../../../src/operations/triggers';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('triggers', () => {
    describe('createTrigger', () => {
      const createTriggerFn = createTrigger(options1);

      it('should return a function', () => {
        expect(createTriggerFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = createTriggerFn(
          'accounts',
          'check_update',
          {
            language: 'plpgsql',
            operation: 'UPDATE',
            when: 'BEFORE',
            function: 'check_account_update',
          },
          null
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(`CREATE TRIGGER "check_update"
  BEFORE UPDATE ON "accounts"
  FOR EACH STATEMENT
  EXECUTE PROCEDURE "check_account_update"();`);
      });

      it('should return sql statement with triggerOptions', () => {
        const statement = createTriggerFn(
          'accounts',
          'check_update',
          {
            language: 'plpgsql',
            operation: ['UPDATE', 'INSERT'],
            when: 'INSTEAD OF',
            function: 'check_account_update',
            replace: true,
            ifExists: true,
            constraint: false,
          },
          'a'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE OR REPLACE FUNCTION "check_account_update"()
  RETURNS trigger
  AS $pga$a$pga$
  VOLATILE
  LANGUAGE plpgsql;
CREATE TRIGGER "check_update"
  INSTEAD OF UPDATE OR INSERT ON "accounts"
  FOR EACH ROW
  EXECUTE PROCEDURE "check_account_update"();`
        );
      });

      it('should return sql statement with schema', () => {
        const statement = createTriggerFn(
          {
            name: 'accounts',
            schema: 'myschema',
          },
          'check_update',
          {
            language: 'plpgsql',
            operation: 'UPDATE',
            when: 'BEFORE',
            constraint: true,
          },
          'a'
        );

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          `CREATE FUNCTION "check_update"()
  RETURNS trigger
  AS $pga$a$pga$
  VOLATILE
  LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "check_update"
  AFTER UPDATE ON "myschema"."accounts"
  NOT DEFERRABLE
  FOR EACH STATEMENT
  EXECUTE PROCEDURE "check_update"();`
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createTriggerFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createTriggerFn.reverse(
            'accounts',
            'check_update',
            {
              language: 'plpgsql',
              operation: 'UPDATE',
              when: 'BEFORE',
              function: 'check_account_update',
            },
            null
          );

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP TRIGGER "check_update" ON "accounts";');
        });
      });
    });
  });
});
