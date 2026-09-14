# Chinook

- Upstream: <https://github.com/lerocha/chinook-database>
- File: `ChinookDatabase/DataSources/Chinook_PostgreSql_SerialPKs.sql`
  (Chinook 1.4.5) at commit
  [`7f67772503d71ba90f19283c38e93923addb43fa`](https://github.com/lerocha/chinook-database/blob/7f67772503d71ba90f19283c38e93923addb43fa/ChinookDatabase/DataSources/Chinook_PostgreSql_SerialPKs.sql)
  (2025-10-05). Its SHA-256 is
  `847361ebbd17aaa18b5423831bf3bfc7ab1f0ad3c62c5bfe4770242bec5ddaf1`.
- `LICENSE` is upstream's `LICENSE.md` (MIT).

`schema.sql` is derived from that file:

1. Lines 16–30 are removed: the "Drop database if it exists" and "Create
   database" comment banners, `DROP DATABASE IF EXISTS chinook_serial;`,
   `CREATE DATABASE chinook_serial;`, `\c chinook_serial;` and the blank
   lines after them. Tests load the fixture into a database they create.
2. All DDL is kept as is: 11 tables with `SERIAL` keys, 11 foreign keys and 11
   indexes, created before the data.
3. The 24 multi-row `INSERT`s are cut down to one `INSERT` per table, in
   upstream order, with rows copied as they are (`N'…'` literals included).
   The foreign keys already exist at that point, so the rows have to be
   consistent. Tables whose `SERIAL` ids other tables refer to keep their
   first rows, up to 5, and stop at the first row that refers to a row that
   wasn't kept, so the generated ids stay equal to upstream's.
   `invoice_line` and `playlist_track` keep up to 5 rows that only refer to
   kept rows. That leaves 5 rows in every table except `invoice` and
   `invoice_line`, which keep 2.

The result has SHA-256
`d1a7491ad97734feb8b89a4b999f1423a29545bbf24e168a2bb90b49deaac1d0`.
