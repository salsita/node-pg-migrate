const { expect } = require('chai');
const Functions = require('../lib/operations/functions');
const { options1, options2 } = require('./utils');

describe('lib/operations/functions', () => {
  const params = ['integer', { name: 'arg2', mode: 'in', type: 'integer' }];
  describe('.create', () => {
    it('check schemas can be used', () => {
      const args = [
        { schema: 'mySchema', name: 'f' },
        params,
        {
          returns: 'integer',
          language: 'plpgsql',
          onNull: 'CALLED'
        },
        `BEGIN
  return $1 + arg2;
END;`
      ];
      const sql1 = Functions.createFunction(options1)(...args);
      const sql2 = Functions.createFunction(options2)(...args);
      expect(sql1).to.equal(
        `CREATE FUNCTION "mySchema"."f"(integer, in "arg2" integer)
  RETURNS integer
  AS $pg1$BEGIN
  return $1 + arg2;
END;$pg1$
  VOLATILE
  LANGUAGE plpgsql;`
      );
      expect(sql2).to.equal(
        `CREATE FUNCTION "my_schema"."f"(integer, in "arg2" integer)
  RETURNS integer
  AS $pg1$BEGIN
  return $1 + arg2;
END;$pg1$
  VOLATILE
  LANGUAGE plpgsql;`
      );
    });

    it('check param shorthands work', () => {
      const args = [
        { schema: 'mySchema', name: 'f' },
        ['integer', 'IN arg2 integer'],
        {
          returns: 'integer',
          language: 'sql',
          behavior: 'IMMUTABLE',
          strict: true
        },
        `SELECT $1 + arg2;`
      ];
      const sql1 = Functions.createFunction(options1)(...args);
      const sql2 = Functions.createFunction(options2)(...args);
      expect(sql1).to.equal(
        `CREATE FUNCTION "mySchema"."f"(integer, IN arg2 integer)
  RETURNS integer
  AS $pg1$SELECT $1 + arg2;$pg1$
  IMMUTABLE
  LANGUAGE sql
  RETURNS NULL ON NULL INPUT;`
      );
      expect(sql2).to.equal(
        `CREATE FUNCTION "my_schema"."f"(integer, IN arg2 integer)
  RETURNS integer
  AS $pg1$SELECT $1 + arg2;$pg1$
  IMMUTABLE
  LANGUAGE sql
  RETURNS NULL ON NULL INPUT;`
      );
    });

    it('check all PG12 options are supported', () => {
      const sql = Functions.createFunction(options1)(
        'myFunction',
        ['a integer', 'b real'],
        {
          returns: 'integer',
          language: 'plpgsql',
          behavior: 'STABLE',
          onNull: 'NULL',
          security: 'DEFINER',
          parallel: 'RESTRICTED',
          cost: 0,
          rows: 7
        },
        'blah-blubb'
      );
      expect(sql).to.equal(
        `CREATE FUNCTION "myFunction"(a integer, b real)
  RETURNS integer
  AS $pg1$blah-blubb$pg1$
  STABLE
  LANGUAGE plpgsql
  RETURNS NULL ON NULL INPUT
  SECURITY DEFINER
  PARALLEL RESTRICTED
  COST 0
  ROWS 7;`
      );
    });
  });

  describe('.rename', () => {
    it('handles all input formats', () => {
      {
        const args = [
          { schema: 'mySchema', name: 'myF' },
          ['integer', 'custom'],
          { schema: 'mySchema', name: 'myG' }
        ];
        const sql1 = Functions.renameFunction(options1)(...args);
        const sql2 = Functions.renameFunction(options2)(...args);
        expect(sql1).to.equal(
          'ALTER FUNCTION "mySchema"."myF"(integer, custom) RENAME TO "myG";'
        );
        expect(sql2).to.equal(
          'ALTER FUNCTION "my_schema"."my_f"(integer, custom) RENAME TO "my_g";'
        );
      }
      {
        const sql = Functions.renameFunction(options2)(
          { schema: 'my_schema', name: 'my_f' },
          ['integer', 'custom'],
          'my_g'
        );
        expect(sql).to.equal(
          'ALTER FUNCTION "my_schema"."my_f"(integer, custom) RENAME TO "my_g";'
        );
      }
      {
        const args = ['myF', ['integer', 'custom'], 'myG'];
        const sql1 = Functions.renameFunction(options1)(...args);
        const sql2 = Functions.renameFunction(options2)(...args);
        expect(sql1).to.equal(
          'ALTER FUNCTION "myF"(integer, custom) RENAME TO "myG";'
        );
        expect(sql2).to.equal(
          'ALTER FUNCTION "my_f"(integer, custom) RENAME TO "my_g";'
        );
      }
    });

    it('can change schemas', () => {
      const args = [
        { schema: 'oldSchema', name: 'myF' },
        ['integer', 'custom'],
        { schema: 'newSchema', name: 'myF' }
      ];
      const sql1 = Functions.renameFunction(options1)(...args);
      const sql2 = Functions.renameFunction(options2)(...args);
      expect(sql1).to.equal(
        'ALTER FUNCTION "oldSchema"."myF"(integer, custom) SET SCHEMA "newSchema";'
      );
      expect(sql2).to.equal(
        'ALTER FUNCTION "old_schema"."my_f"(integer, custom) SET SCHEMA "new_schema";'
      );
    });

    it('can change both schema and name', () => {
      const args = [
        { schema: 'oldSchema', name: 'myF' },
        ['integer', 'custom'],
        { schema: 'newSchema', name: 'myG' }
      ];
      const sql1 = Functions.renameFunction(options1)(...args);
      const sql2 = Functions.renameFunction(options2)(...args);
      expect(sql1).to.equal(
        `ALTER FUNCTION "oldSchema"."myF"(integer, custom) SET SCHEMA "newSchema";
ALTER FUNCTION "newSchema"."myF"(integer, custom) RENAME TO "myG";`
      );
      expect(sql2).to.equal(
        `ALTER FUNCTION "old_schema"."my_f"(integer, custom) SET SCHEMA "new_schema";
ALTER FUNCTION "new_schema"."my_f"(integer, custom) RENAME TO "my_g";`
      );
    });
  });
});
