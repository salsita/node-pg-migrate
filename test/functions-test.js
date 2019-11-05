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
});
