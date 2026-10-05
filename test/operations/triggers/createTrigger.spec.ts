import { describe, expect, it } from 'vitest';
import type {
  CreateTriggerFn1,
  TriggerOptions,
} from '../../../src/operations/triggers';
import { createTrigger } from '../../../src/operations/triggers';
import {
  options1,
  options1Pretty,
  options2,
} from '../../presetMigrationOptions';

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
        expect(statement).toBe(
          `CREATE TRIGGER "check_update" BEFORE UPDATE ON "accounts" FOR EACH STATEMENT EXECUTE PROCEDURE "check_account_update"();`
        );
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
          `CREATE OR REPLACE FUNCTION "check_account_update"() RETURNS trigger AS $pga$a$pga$ VOLATILE LANGUAGE plpgsql;
CREATE TRIGGER "check_update" INSTEAD OF UPDATE OR INSERT ON "accounts" FOR EACH ROW EXECUTE PROCEDURE "check_account_update"();`
        );
      });

      it('should format the statement across multiple lines when pretty is enabled', () => {
        const statement = createTrigger(options1Pretty)(
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
        expect(statement)
          .toBe(`CREATE OR REPLACE FUNCTION "check_account_update"()
  RETURNS trigger
  AS $pga$a$pga$
  VOLATILE
  LANGUAGE plpgsql;
CREATE TRIGGER "check_update"
  INSTEAD OF UPDATE OR INSERT ON "accounts"
  FOR EACH ROW
  EXECUTE PROCEDURE "check_account_update"();`);
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
          `CREATE FUNCTION "check_update"() RETURNS trigger AS $pga$a$pga$ VOLATILE LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "check_update" AFTER UPDATE ON "myschema"."accounts" NOT DEFERRABLE FOR EACH STATEMENT EXECUTE PROCEDURE "check_update"();`
        );
      });

      describe('updateOf', () => {
        const create = createTriggerFn as CreateTriggerFn1;
        const defaults: TriggerOptions = {
          when: 'AFTER',
          operation: 'UPDATE',
          function: 'check_account_update',
        };

        it.each([
          { columns: 'name', sql: '"name"' },
          {
            columns: ['first_name', 'last_name'],
            sql: '"first_name", "last_name"',
          },
          { columns: 'CamelCaseColumn', sql: '"CamelCaseColumn"' },
          { columns: 'order', sql: '"order"' },
          { columns: 'first-name', sql: '"first-name"' },
          { columns: 'full name', sql: '"full name"' },
          { columns: 'a,b', sql: '"a,b"' },
          { columns: 'a"b', sql: '"a""b"' },
          { columns: 'Straße', sql: '"Straße"' },
          { columns: 'a.b', sql: '"a.b"' },
          { columns: '   ', sql: '"   "' },
        ])('should quote $columns as identifiers', ({ columns, sql }) => {
          expect(
            create('accounts', 'check_update', {
              ...defaults,
              updateOf: columns,
            })
          ).toBe(
            `CREATE TRIGGER "check_update" AFTER UPDATE OF ${sql} ON "accounts" FOR EACH STATEMENT EXECUTE PROCEDURE "check_account_update"();`
          );
        });

        it.each(['UPDATE', 'update', 'UpDaTe', ' UPDATE\t'])(
          'should recognize %s',
          (operation) => {
            expect(
              create('accounts', 'check_update', {
                ...defaults,
                operation: ['INSERT', operation, 'DELETE'],
                updateOf: 'name',
              })
            ).toBe(
              'CREATE TRIGGER "check_update" AFTER INSERT OR UPDATE OF "name" OR DELETE ON "accounts" FOR EACH STATEMENT EXECUTE PROCEDURE "check_account_update"();'
            );
          }
        );

        it('should decamelize columns using the identifier renderer', () => {
          const create = createTrigger(options2) as CreateTriggerFn1;
          expect(
            create('accounts', 'check_update', {
              ...defaults,
              updateOf: ['isMember', 'displayName'],
            })
          ).toContain('UPDATE OF "is_member", "display_name"');
        });

        it.each([
          { operation: 'INSERT', sql: 'INSERT' },
          { operation: 'UPDATE', sql: 'UPDATE' },
          { operation: 'DELETE', sql: 'DELETE' },
          { operation: 'TRUNCATE', sql: 'TRUNCATE' },
          { operation: '   ', sql: '   ' },
          { operation: ['', ''], sql: ' OR ' },
          {
            operation: ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'],
            sql: 'INSERT OR UPDATE OR DELETE OR TRUNCATE',
          },
          { operation: 'UPDATE OF name', sql: 'UPDATE OF name' },
          {
            operation: ['UPDATE OF first_name, last_name'],
            sql: 'UPDATE OF first_name, last_name',
          },
          {
            operation: ['INSERT', 'UPDATE OF "CamelCaseColumn"', 'DELETE'],
            sql: 'INSERT OR UPDATE OF "CamelCaseColumn" OR DELETE',
          },
          {
            operation: 'update of "a,b", "a""b"',
            sql: 'update of "a,b", "a""b"',
          },
          {
            operation: 'INSERT OR UPDATE OF name',
            sql: 'INSERT OR UPDATE OF name',
          },
        ])(
          'should preserve the legacy operation $operation',
          ({ operation, sql }) => {
            const expected = `CREATE TRIGGER "check_update" AFTER ${sql} ON "accounts" FOR EACH STATEMENT EXECUTE PROCEDURE "check_account_update"();`;
            expect(
              create('accounts', 'check_update', { ...defaults, operation })
            ).toBe(expected);
            expect(
              create('accounts', 'check_update', {
                ...defaults,
                operation,
                updateOf: [],
              })
            ).toBe(expected);
            const createDecamelized = createTrigger(
              options2
            ) as CreateTriggerFn1;
            expect(
              createDecamelized('accounts', 'check_update', {
                ...defaults,
                operation,
              })
            ).toBe(expected);
          }
        );

        it.each(['', [], ['']].map((operation) => ({ operation })))(
          'should reject the empty operation $operation',
          ({ operation }) => {
            for (const updateOf of [undefined, [], 'name']) {
              expect(() =>
                create('accounts', 'check_update', {
                  ...defaults,
                  operation,
                  updateOf,
                })
              ).toThrow(
                new Error(
                  '"operation" (INSERT/UPDATE[ OF ...]/DELETE/TRUNCATE) have to be specified'
                )
              );
            }
          }
        );

        it.each(
          [
            'INSERT',
            ['INSERT', 'DELETE'],
            'INSERT OR UPDATE',
            'UPDATE OR INSERT',
            'INSERT OR UPDATE OF x',
          ].map((operation) => ({ operation }))
        )(
          'should reject updateOf without a standalone UPDATE event: $operation',
          ({ operation }) => {
            expect(() =>
              create('accounts', 'check_update', {
                ...defaults,
                operation,
                updateOf: 'name',
              })
            ).toThrow(
              new Error(
                '"updateOf" requires a standalone UPDATE event in "operation"; pass multiple events as an array'
              )
            );
          }
        );

        it.each(['', ['a', '']].map((updateOf) => ({ updateOf })))(
          'should reject empty column names in $updateOf',
          ({ updateOf }) => {
            expect(() =>
              create('accounts', 'check_update', {
                ...defaults,
                updateOf,
              })
            ).toThrow(new Error('"updateOf" column names must not be empty'));
          }
        );

        it.each(
          [
            'UPDATE OF name',
            ['INSERT', 'update\tof "CamelCaseColumn"'],
            ['UPDATE', ' UPDATE OF name'],
          ].map((operation) => ({ operation }))
        )(
          'should reject a conflicting column list: $operation',
          ({ operation }) => {
            expect(() =>
              create('accounts', 'check_update', {
                ...defaults,
                operation,
                updateOf: 'name',
              })
            ).toThrow(
              '"updateOf" cannot be combined with UPDATE OF in "operation"'
            );
          }
        );

        it.each([
          { operation: 'UPDATE', updateOf: 'name' },
          { operation: 'INSERT', updateOf: 'name' },
          { operation: 'UPDATE OF name', updateOf: 'name' },
          { operation: 'UPDATE', updateOf: '' },
        ])(
          'should reject INSTEAD OF before validating $operation and $updateOf',
          ({ operation, updateOf }) => {
            expect(() =>
              create('accounts', 'check_update', {
                ...defaults,
                when: 'INSTEAD OF',
                operation,
                updateOf,
              })
            ).toThrow(
              new Error('INSTEAD OF trigger cannot have "updateOf" specified')
            );
          }
        );

        it('should allow an empty column list for INSTEAD OF triggers', () => {
          expect(
            create('accounts', 'check_update', {
              ...defaults,
              when: 'INSTEAD OF',
              updateOf: [],
            })
          ).toContain('INSTEAD OF UPDATE ON "accounts" FOR EACH ROW');
        });

        it('should use the effective timing of constraint triggers', () => {
          expect(
            create('accounts', 'check_update', {
              ...defaults,
              constraint: true,
              when: 'INSTEAD OF',
              level: 'ROW',
              updateOf: 'name',
            })
          ).toBe(
            'CREATE CONSTRAINT TRIGGER "check_update" AFTER UPDATE OF "name" ON "accounts" NOT DEFERRABLE FOR EACH ROW EXECUTE PROCEDURE "check_account_update"();'
          );
        });

        it('should preserve schemas and pretty formatting with an inline function', () => {
          expect(
            createTrigger(options1Pretty)(
              { schema: 'myschema', name: 'accounts' },
              'check_update',
              {
                when: 'BEFORE',
                operation: 'UPDATE',
                updateOf: 'name',
                language: 'plpgsql',
              },
              'BEGIN RETURN NEW; END;'
            )
          ).toBe(`CREATE FUNCTION "check_update"()
  RETURNS trigger
  AS $pga$BEGIN RETURN NEW; END;$pga$
  VOLATILE
  LANGUAGE plpgsql;
CREATE TRIGGER "check_update"
  BEFORE UPDATE OF "name" ON "myschema"."accounts"
  FOR EACH STATEMENT
  EXECUTE PROCEDURE "check_update"();`);
        });

        it('should leave automatic reversal unchanged', () => {
          expect(
            createTriggerFn.reverse(
              'accounts',
              'check_update',
              {
                ...defaults,
                language: 'plpgsql',
                updateOf: 'name',
              },
              null
            )
          ).toBe('DROP TRIGGER "check_update" ON "accounts";');
          expect(
            createTriggerFn.reverse(
              'accounts',
              'check_update',
              {
                when: 'AFTER',
                operation: 'UPDATE',
                language: 'plpgsql',
                updateOf: 'name',
              },
              'BEGIN RETURN NEW; END;'
            )
          ).toBe(
            'DROP TRIGGER "check_update" ON "accounts";\nDROP FUNCTION "check_update"();'
          );
        });
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
