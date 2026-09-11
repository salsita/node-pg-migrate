import type { ClientConfig } from 'pg';
import { BaselineError } from '../errors';

/**
 * The connection settings of a connection string, as text; unknown ones are
 * left out.
 */
interface ConnectionSettings {
  readonly host?: string;
  readonly port?: string;
  readonly user?: string;
  readonly password?: string;
  readonly database?: string;
  readonly sslmode?: string;
}

/**
 * An empty or missing value is unknown.
 */
function known(value: string | null | undefined): string | undefined {
  return value || undefined;
}

/**
 * Decodes percent-encoded text, or keeps it as it is when it is not valid
 * percent-encoding.
 */
function decode(
  text: string,
  decoder: (encoded: string) => string = decodeURIComponent
): string {
  try {
    return decoder(text);
  } catch {
    return text;
  }
}

/**
 * Parses a URL without echoing it on failure: the error of `new URL()` quotes
 * its input, and with it the password.
 */
function parseUrl(connectionString: string): URL {
  try {
    return new URL(connectionString);
  } catch {
    throw new BaselineError(
      'INVALID_OPTIONS',
      'the connection string is not a valid URL, such as postgres://user:password@host:5432/database.'
    );
  }
}

/**
 * The host of a URL, decoded (a socket directory is written
 * `%2Fvar%2Frun%2Fpostgresql`), without the brackets of an IPv6 address.
 */
function hostOf(url: URL): string {
  const host = decode(url.hostname);

  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

/**
 * Parses a connection string the way node-postgres does
 * (`pg-connection-string`): a `postgres://` URL, whose `host`, `port`, `user`
 * and `password` query parameters win over the other parts; a
 * `socket:/directory?db=database` URL; or a socket directory followed by a
 * space and the database.
 */
function parseConnectionString(connectionString: string): ConnectionSettings {
  if (connectionString.startsWith('/')) {
    const [host, database] = connectionString.split(' ');

    return { host: known(host), database: known(database) };
  }

  const url = parseUrl(connectionString);
  const params = url.searchParams;
  const sslmode = known(params.get('sslmode'));
  if (url.protocol === 'socket:') {
    return {
      host: known(decode(url.pathname, decodeURI)),
      database: known(params.get('db')),
      sslmode,
    };
  }

  return {
    host: known(params.get('host')) ?? known(hostOf(url)),
    port: known(params.get('port')) ?? known(url.port),
    user: known(params.get('user')) ?? known(decode(url.username)),
    password: known(params.get('password')) ?? known(decode(url.password)),
    database: known(decode(url.pathname.slice(1), decodeURI)),
    sslmode,
  };
}

/**
 * The password of a client config, calling it when it is a function.
 */
async function passwordOf(
  password: ClientConfig['password']
): Promise<string | undefined> {
  return known(typeof password === 'function' ? await password() : password);
}

/**
 * The libpq `sslmode` of a connection: the `sslmode` of its connection string
 * as it is (but node-postgres' `no-verify`, which is `require`), else
 * `require` for an `ssl` config with `rejectUnauthorized: false`, and
 * `verify-full` for any other `ssl` config.
 */
function sslModeOf(
  sslmode: string | undefined,
  ssl: ClientConfig['ssl']
): string | undefined {
  if (sslmode !== undefined) {
    return sslmode === 'no-verify' ? 'require' : sslmode;
  }

  if (!ssl) {
    return undefined;
  }

  return typeof ssl === 'object' && ssl.rejectUnauthorized === false
    ? 'require'
    : 'verify-full';
}

/**
 * The libpq environment variables (`PGHOST`, `PGPORT`, `PGUSER`,
 * `PGPASSWORD`, `PGDATABASE` and `PGSSLMODE`) that point pg_dump to the
 * database of a node-postgres connection, so that no credential has to appear
 * in pg_dump's arguments.
 *
 * Like node-postgres, the settings of a connection string win over the other
 * fields of a client config. Settings the connection does not give are left
 * out, so pg_dump falls back to its environment and defaults for them.
 *
 * @param connection A connection string (URL) or a client config. A
 * `password` function in the client config is called.
 */
export async function toPgEnv(
  connection: string | ClientConfig
): Promise<Record<string, string>> {
  const config: ClientConfig =
    typeof connection === 'string'
      ? { connectionString: connection }
      : connection;
  const url: ConnectionSettings =
    config.connectionString === undefined
      ? {}
      : parseConnectionString(config.connectionString);
  const settings: Record<string, string | undefined> = {
    PGHOST: url.host ?? known(config.host),
    PGPORT: url.port ?? known(config.port?.toString()),
    PGUSER: url.user ?? known(config.user),
    PGPASSWORD: url.password ?? (await passwordOf(config.password)),
    PGDATABASE: url.database ?? known(config.database),
    PGSSLMODE: sslModeOf(url.sslmode, config.ssl),
  };

  return Object.fromEntries(
    Object.entries(settings).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  );
}
