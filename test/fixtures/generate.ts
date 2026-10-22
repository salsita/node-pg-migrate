/**
 * Checks that a table count is a positive safe integer.
 *
 * @param tables The number of tables.
 *
 * @throws Throws a `RangeError` otherwise.
 */
function assertTableCount(tables: number): void {
  if (!Number.isSafeInteger(tables) || tables < 1) {
    throw new RangeError(
      `tables must be a positive integer, got ${String(tables)}`
    );
  }
}

/**
 * Names the tables of a generated schema so that they sort by number.
 *
 * @param prefix The name prefix, e.g. `stress`.
 * @param tables The number of tables.
 *
 * @returns A function from a 1-based table number to its name, e.g.
 * `stress_00001`.
 */
function tableNamer(prefix: string, tables: number): (n: number) => string {
  const width = Math.max(5, String(tables).length);

  return (n) => `${prefix}_${String(n).padStart(width, '0')}`;
}

/**
 * Generates the stress schema: plain SQL that `psql -f` can load into an empty
 * database, the same text for the same `tables`.
 *
 * It starts with one PL/pgSQL trigger function, `public.stress_touch_updated_at()`.
 * Then, for every table `public.stress_<n>` (`n` from 1, zero-padded to at
 * least 5 digits):
 *
 * - 10 columns: `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`,
 *   `parent_id bigint` (a foreign key to the previous table, except in the
 *   first table), `name text NOT NULL`, `email text UNIQUE`,
 *   `status text NOT NULL DEFAULT 'active'` with a CHECK constraint,
 *   `amount numeric(12,2) DEFAULT 0`,
 *   `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz`,
 *   `meta jsonb DEFAULT '{}'::jsonb` and `tags text[] DEFAULT '{}'`;
 * - 2 more indexes: `<table>_name_idx` on `name` and the partial expression
 *   index `<table>_active_email_idx` on `lower(email)`;
 * - a table comment.
 *
 * Every 10th table also gets a view `<table>_active`, a `LANGUAGE sql` function
 * `<table>_total(text)` and a `BEFORE UPDATE` trigger `<table>_touch` that runs
 * the shared trigger function.
 *
 * So `tables` tables come with `tables` identity sequences, `2 * tables`
 * index-backed constraints (primary key and unique), `2 * tables` more indexes,
 * `tables - 1` foreign keys, `floor(tables / 10)` views and triggers, and
 * `floor(tables / 10) + 1` functions.
 *
 * @param tables The number of tables, at least 1.
 *
 * @returns The SQL script.
 *
 * @throws Throws a `RangeError` if `tables` is not a positive integer.
 */
export function generateStressSchema(tables: number): string {
  assertTableCount(tables);
  const name = tableNamer('stress', tables);

  const parts = [
    `CREATE FUNCTION public.stress_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
`,
  ];

  for (let n = 1; n <= tables; n++) {
    const table = name(n);
    const parent = n > 1 ? ` REFERENCES public.${name(n - 1)} (id)` : '';
    parts.push(`
CREATE TABLE public.${table} (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parent_id bigint${parent},
    name text NOT NULL,
    email text UNIQUE,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    amount numeric(12,2) DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz,
    meta jsonb DEFAULT '{}'::jsonb,
    tags text[] DEFAULT '{}'
);

CREATE INDEX ${table}_name_idx ON public.${table} (name);

CREATE INDEX ${table}_active_email_idx ON public.${table} (lower(email)) WHERE status = 'active';

COMMENT ON TABLE public.${table} IS 'Stress table ${n}';
`);

    if (n % 10 === 0) {
      parts.push(`
CREATE VIEW public.${table}_active AS
    SELECT id, name, email FROM public.${table} WHERE status = 'active';

CREATE FUNCTION public.${table}_total(p_status text) RETURNS numeric
    LANGUAGE sql STABLE
    AS $$
    SELECT coalesce(sum(amount), 0) FROM public.${table} WHERE status = p_status
$$;

CREATE TRIGGER ${table}_touch BEFORE UPDATE ON public.${table}
    FOR EACH ROW EXECUTE FUNCTION public.stress_touch_updated_at();
`);
    }
  }

  return parts.join('');
}

/**
 * The `\restrict` key of {@link generateDumpLike}: 63 letters and digits, like
 * the random keys of real dumps, but fixed.
 */
const DUMP_LIKE_RESTRICT_KEY =
  'GeneratedByNodePgMigrateTestsDumpLike0123456789abcdefghijklmnop';

const DUMP_LIKE_HEADER = `--
-- PostgreSQL database dump
--

\\restrict ${DUMP_LIKE_RESTRICT_KEY}

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

`;

const DUMP_LIKE_FOOTER = `--
-- PostgreSQL database dump complete
--

\\unrestrict ${DUMP_LIKE_RESTRICT_KEY}

`;

/**
 * Formats one entry of a plain-text dump the way `pg_dump` does: a
 * `-- Name: …; Type: …` comment, the statement and two blank lines.
 *
 * @param name The name in the comment, e.g. `dump_00001 dump_00001_pkey`.
 * @param type The type in the comment, e.g. `CONSTRAINT`.
 * @param statement The SQL statement, without a trailing newline.
 *
 * @returns The entry.
 */
function dumpEntry(name: string, type: string, statement: string): string {
  return `--
-- Name: ${name}; Type: ${type}; Schema: public; Owner: -
--

${statement}


`;
}

/**
 * Generates text shaped like the plain-text output of
 * `pg_dump --schema-only --no-owner --no-privileges` 18.6, without a
 * database, for unit and performance tests. The same `tables` always give the
 * same text, including the fixed `\restrict` key.
 *
 * It follows `pg_dump`'s layout: the `\restrict` line, the `SET` preamble with
 * `set_config('search_path', '', false)`, `-- Name: …; Type: …` entries in
 * `pg_dump`'s order (functions, tables with their comments, views and
 * sequences, column defaults, constraints, indexes, triggers, foreign keys)
 * and the `\unrestrict` line at the end.
 *
 * The schema is like {@link generateStressSchema}'s, in tables
 * `public.dump_<n>`: odd tables get an identity column
 * (`ALTER TABLE … ADD GENERATED ALWAYS AS IDENTITY`), even ones a sequence
 * (`CREATE SEQUENCE`, `ALTER SEQUENCE … OWNED BY` and a
 * `nextval(…)` default). Every 10th table gets a view, a `LANGUAGE sql`
 * function with a `$_$`-quoted body and a trigger that runs the shared
 * PL/pgSQL function (`$$`-quoted).
 *
 * The output has `tables` `CREATE TABLE`s and table comments, `tables`
 * sequences (`ceil(tables / 2)` identity, `floor(tables / 2)`
 * `CREATE SEQUENCE`), `2 * tables` `CREATE INDEX`es, `2 * tables` index-backed
 * constraints (`PRIMARY KEY`, `UNIQUE`), `tables - 1` foreign keys,
 * `floor(tables / 10)` views and triggers, `floor(tables / 10) + 1` functions
 * and no materialized views. That's about 2 KB per table. It loads with
 * `psql` into PostgreSQL 17 or later (its `SET transaction_timeout` is new in
 * 17).
 *
 * @param tables The number of tables, at least 1.
 *
 * @returns The dump text.
 *
 * @throws Throws a `RangeError` if `tables` is not a positive integer.
 */
export function generateDumpLike(tables: number): string {
  assertTableCount(tables);
  const name = tableNamer('dump', tables);
  const numbers = Array.from({ length: tables }, (_, index) => index + 1);
  const everyTenth = numbers.filter((n) => n % 10 === 0);
  const withSequence = numbers.filter((n) => n % 2 === 0);

  const parts = [DUMP_LIKE_HEADER];

  for (const n of everyTenth) {
    const table = name(n);
    parts.push(
      dumpEntry(
        `${table}_total(text)`,
        'FUNCTION',
        `CREATE FUNCTION public.${table}_total(p_status text) RETURNS numeric
    LANGUAGE sql STABLE
    AS $_$
    SELECT coalesce(sum(amount), 0) FROM public.${table} WHERE status = $1
$_$;`
      )
    );
  }

  parts.push(
    dumpEntry(
      'dump_touch_updated_at()',
      'FUNCTION',
      `CREATE FUNCTION public.dump_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;`
    ),
    "SET default_tablespace = '';\n\nSET default_table_access_method = heap;\n\n"
  );

  for (const n of numbers) {
    const table = name(n);
    parts.push(
      dumpEntry(
        table,
        'TABLE',
        `CREATE TABLE public.${table} (
    id bigint NOT NULL,
    parent_id bigint,
    name text NOT NULL,
    email text,
    status text DEFAULT 'active'::text NOT NULL,
    amount numeric(12,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    meta jsonb DEFAULT '{}'::jsonb,
    tags text[] DEFAULT '{}'::text[],
    CONSTRAINT ${table}_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);`
      ),
      dumpEntry(
        `TABLE ${table}`,
        'COMMENT',
        `COMMENT ON TABLE public.${table} IS 'Dump-like table ${n}';`
      )
    );

    if (n % 10 === 0) {
      parts.push(
        dumpEntry(
          `${table}_active`,
          'VIEW',
          `CREATE VIEW public.${table}_active AS
 SELECT id,
    name,
    email
   FROM public.${table}
  WHERE (status = 'active'::text);`
        )
      );
    }

    if (n % 2 === 0) {
      parts.push(
        dumpEntry(
          `${table}_id_seq`,
          'SEQUENCE',
          `CREATE SEQUENCE public.${table}_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;`
        ),
        dumpEntry(
          `${table}_id_seq`,
          'SEQUENCE OWNED BY',
          `ALTER SEQUENCE public.${table}_id_seq OWNED BY public.${table}.id;`
        )
      );
    } else {
      parts.push(
        dumpEntry(
          `${table}_id_seq`,
          'SEQUENCE',
          `ALTER TABLE public.${table} ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.${table}_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);`
        )
      );
    }
  }

  for (const n of withSequence) {
    const table = name(n);
    parts.push(
      dumpEntry(
        `${table} id`,
        'DEFAULT',
        `ALTER TABLE ONLY public.${table} ALTER COLUMN id SET DEFAULT nextval('public.${table}_id_seq'::regclass);`
      )
    );
  }

  for (const n of numbers) {
    const table = name(n);
    parts.push(
      dumpEntry(
        `${table} ${table}_email_key`,
        'CONSTRAINT',
        `ALTER TABLE ONLY public.${table}\n    ADD CONSTRAINT ${table}_email_key UNIQUE (email);`
      ),
      dumpEntry(
        `${table} ${table}_pkey`,
        'CONSTRAINT',
        `ALTER TABLE ONLY public.${table}\n    ADD CONSTRAINT ${table}_pkey PRIMARY KEY (id);`
      )
    );
  }

  for (const n of numbers) {
    const table = name(n);
    parts.push(
      dumpEntry(
        `${table}_active_email_idx`,
        'INDEX',
        `CREATE INDEX ${table}_active_email_idx ON public.${table} USING btree (lower(email)) WHERE (status = 'active'::text);`
      ),
      dumpEntry(
        `${table}_name_idx`,
        'INDEX',
        `CREATE INDEX ${table}_name_idx ON public.${table} USING btree (name);`
      )
    );
  }

  for (const n of everyTenth) {
    const table = name(n);
    parts.push(
      dumpEntry(
        `${table} ${table}_touch`,
        'TRIGGER',
        `CREATE TRIGGER ${table}_touch BEFORE UPDATE ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.dump_touch_updated_at();`
      )
    );
  }

  for (const n of numbers.slice(1)) {
    const table = name(n);
    parts.push(
      dumpEntry(
        `${table} ${table}_parent_id_fkey`,
        'FK CONSTRAINT',
        `ALTER TABLE ONLY public.${table}\n    ADD CONSTRAINT ${table}_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.${name(n - 1)}(id);`
      )
    );
  }

  parts.push(DUMP_LIKE_FOOTER);

  return parts.join('');
}
