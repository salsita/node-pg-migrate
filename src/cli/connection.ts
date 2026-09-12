import type { ClientConfig } from 'pg';
// TODO causes tests to fail when `.js` is removed
// @ts-expect-error type exports from @types/pg doesn't match importing
import ConnectionParameters from 'pg/lib/connection-parameters.js';
import type { ResolvedConfig } from './config';

/**
 * A database connection of the resolved configuration.
 */
export type DbConnection = NonNullable<ResolvedConfig['dbConnection']>;

/**
 * Finds the database connection of a command: the one of the configuration
 * (the `--database-url-var` environment variable, the `config` package or
 * `--config-file`), else the libpq environment variables (`PGHOST`, `PGUSER`,
 * `PGDATABASE`, …) when they name a host, a user and a database.
 *
 * @param config The resolved configuration.
 * @returns The connection, or `undefined` when there is none.
 */
export function findDbConnection(
  config: ResolvedConfig
): DbConnection | undefined {
  if (config.dbConnection) {
    return config.dbConnection;
  }

  const cp = new ConnectionParameters();

  const dbUrlFromEnv = config.databaseUrlVar
    ? process.env[config.databaseUrlVar]
    : undefined;
  if (!dbUrlFromEnv && (!process.env.PGHOST || !cp.user || !cp.database)) {
    return undefined;
  }

  return cp;
}

/**
 * Finds the database connection of a command that cannot run without one
 * (see {@link findDbConnection}). When there is none, it says so and exits
 * the process with code 1.
 *
 * @param config The resolved configuration.
 * @returns The connection.
 */
export function requireDbConnection(config: ResolvedConfig): DbConnection {
  const connection = findDbConnection(config);
  if (connection === undefined) {
    console.error(
      `The ${config.databaseUrlVar} environment variable is not set or incomplete connection parameters are provided.`
    );
    process.exit(1);
  }

  return connection;
}

/**
 * A connection for `baseline()`, which gives node-postgres and pg_dump the
 * same connection settings: a connection string, or the connection settings
 * of a client config (`connectionString`, `host`, `port`, `user`, `password`,
 * `database` and `ssl`). `--reject-unauthorized` sets
 * `ssl.rejectUnauthorized`, like it does for `up` and `down`.
 *
 * A connection made of the libpq environment variables (see
 * {@link findDbConnection}) leaves `ssl` out: node-postgres then reads
 * `PGSSLMODE` itself, and pg_dump gets the user's own `PGSSLMODE`,
 * `PGSSLROOTCERT`, … as they are.
 *
 * @param connection The database connection.
 * @param rejectUnauthorized `--reject-unauthorized`, when it is given.
 */
export function baselineConnection(
  connection: DbConnection,
  rejectUnauthorized: boolean | undefined
): string | ClientConfig {
  const config: ClientConfig =
    typeof connection === 'string'
      ? { connectionString: connection }
      : {
          ...('connectionString' in connection
            ? { connectionString: connection.connectionString }
            : undefined),
          host: connection.host,
          port: connection.port,
          user: connection.user,
          password: connection.password,
          database: connection.database,
          ssl:
            connection instanceof ConnectionParameters
              ? undefined
              : connection.ssl,
        };

  if (rejectUnauthorized === undefined) {
    return typeof connection === 'string' ? connection : config;
  }

  return {
    ...config,
    ssl: {
      ...(typeof config.ssl === 'object' ? config.ssl : undefined),
      rejectUnauthorized,
    },
  };
}
