# Pagila

- Upstream: <https://github.com/devrimgunduz/pagila>
- File: `pagila-schema.sql` at commit
  [`23f7fe7a1e9f5772f85fc14f530583ffa258c6d2`](https://github.com/devrimgunduz/pagila/blob/23f7fe7a1e9f5772f85fc14f530583ffa258c6d2/pagila-schema.sql)
  (2026-07-28, "Change language.name from character(20) to text").
- `schema.sql` is that file byte for byte (SHA-256
  `18de72ae8669a0099b47be6d54b60ca5334114f38db65bf21ae82b0fc752d1ad`), with
  no edits.
- `LICENSE` is upstream's `LICENSE.txt` (MIT) at the same commit.

The file is `pg_dump` output (its header says PostgreSQL 12.11, dumped by
`pg_dump` 15beta2) that upstream edits by hand. It has the `SET` preamble,
`set_config('search_path', '', false)`, `ALTER … OWNER TO postgres` lines, a
range-partitioned `payment` table with 55 `ATTACH PARTITION`s, 2 domains (one
named `"bıgınt"`), an enum, 9 functions, a custom aggregate, 15 triggers, 7
views and a materialized view.

It is the last revision before upstream's commits `aeb87bcb`, `8ca0e3e9` and
`85bf46a5` (the file has not changed since, up to `eddcfc45`). They add
`uuidv7()` defaults, the pgvector extension and a `VIRTUAL` generated column.
pgvector is not in the stock `postgres:14-alpine` to `postgres:18-alpine`
images, and the other two need PostgreSQL 18, so later revisions don't load
there.

`loadFixture()` creates the role `postgres` before loading it, like a restore
needs the roles a dump refers to. The dump leaves `public` owned by
`postgres`. `pg_dump` 15+ then prints a comment-only entry for `public`, and
`dumpSchema()` drops it (see its JSDoc).
