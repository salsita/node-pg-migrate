# Troubleshooting

## SSL connection

For SSL connection to DB you can set `PGSSLMODE` environment variable to value from [list](https://www.postgresql.org/docs/current/static/libpq-connect.html#LIBPQ-CONNECT-SSLMODE) other then `disable`.
e.g. `PGSSLMODE=require node-pg-migrate up` ([pg](https://github.com/brianc/node-postgres/blob/master/CHANGELOG.md#v260) will take it into account)

Or you can append `?ssl=true` to your `DATABASE_URL`

For setting SSL certificates etc. you will need to use some form of JSON config [see](cli.md)
with proper SSL configuration [see](https://node-postgres.com/features/ssl)

With the introduction of pg v8, SSL connection options use node defaults. That means e.g. rejecting self-signed
certificates. To be able to accept self-signed certificates you can use `--no-reject-unauthorized` CLI option
or pass database connection info through JSON configuration [see](cli.md).
For explanation [see](https://node-postgres.com/announcements#2020-02-25) and [see](https://github.com/brianc/node-postgres/issues/2009).
Do not combine it with `?ssl=true` as it overrides ssl config from `--no-reject-unauthorized`.

## Camel case, Snake case, case sensitivity

In PostgreSQL unquoted identifiers are case-insensitive. Thus `SELECT * FROM hello` and `SELECT * FROM HELLO` are equivalent.
However, quoted identifiers are case-sensitive. `SELECT * FROM "hello"`, `SELECT * FROM "HELLO"` and `SELECT * FROM "HeLLo"`
are trying to read from three different tables.
Unquoted identifiers are always folded to lower case.
[see](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)

`node-pg-migrate` always quotes all identifiers, so make sure you also quote them in your SQL (and so does eventual library you use).
Or always use lower case identifiers to prevent confusion (unquoted identifiers are always folded to lower case - see above).

`node-pg-migrate` also comes with `decamelize` flag which runs `decamelize` package on all table/column/etc. names ([see](cli.md#configuration)). That means that your camel case identifiers will be converted to snake case (lower cased).

## Refused connection issues

- Password to your database may not contain some characters (which have special meaning in url schema) when used in `DATABASE_URL`.
  Use other means to provide password or change the password. [see](https://github.com/salsita/node-pg-migrate/issues/439)
- Make sure connection is not stopped by firewalls, security rules, etc.
  Try `telnet url port` to try to connect (e.g. `telnet 127.0.0.1 5432`) to postgres server.
  If command will not end with error, but will wait for further input from you, server (or some other service running on that port :man_shrugging:) is accessible and waits for correct user/password.
  Otherwise server does not run or listen on specified port or there is some other connection problem. You have to investigate...

## Running in transaction

Some DB operations like add type value (`pgm.addTypeValue`) does not work if the type is not created in the same
transaction. E.g. if it is created in previous migration. You need to run specific migration outside transaction
(`pgm.noTransaction`).
