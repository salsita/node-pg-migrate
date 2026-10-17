import { inspect } from 'node:util';
import type {
  Client,
  ClientBase,
  ClientConfig,
  QueryArrayConfig,
  QueryArrayResult,
  QueryConfig,
  QueryResult,
} from 'pg';
import pg from 'pg';
import type { Logger } from './logger';
import { formatQueryError } from './utils';

// This file just manages the database connection and provides a query method

// see ClientBase in @types/pg
export interface DB {
  query(
    queryConfig: QueryArrayConfig,
    values?: any[]
  ): Promise<QueryArrayResult>;
  query(queryConfig: QueryConfig): Promise<QueryResult>;
  query(
    queryTextOrConfig: string | QueryConfig,
    values?: any[]
  ): Promise<QueryResult>;

  select(queryConfig: QueryArrayConfig, values?: any[]): Promise<any[]>;
  select(queryConfig: QueryConfig): Promise<any[]>;
  select(
    queryTextOrConfig: string | QueryConfig,
    values?: any[]
  ): Promise<any[]>;
}

export interface DBConnection extends DB {
  createConnection(): Promise<void>;

  column(
    columnName: string,
    queryConfig: QueryArrayConfig,
    values?: any[]
  ): Promise<any[]>;
  column(columnName: string, queryConfig: QueryConfig): Promise<any[]>;
  column(
    columnName: string,
    queryTextOrConfig: string | QueryConfig,
    values?: any[]
  ): Promise<any[]>;

  connected: () => boolean;

  addBeforeCloseListener: (listener: any) => number;

  close(): Promise<void>;
}

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTED' | 'ERROR' | 'EXTERNAL';

function isClientBase(
  connection: ClientBase | string | ClientConfig
): connection is ClientBase {
  return (
    typeof connection === 'object' &&
    'query' in connection &&
    typeof connection.query === 'function'
  );
}

export function db(
  connection: ClientBase | string | ClientConfig,
  logger: Logger = console
): DBConnection {
  // A client we create ourselves is also ours to close again, while an
  // externally provided one stays under the caller's control.
  let ownClient: Client | undefined;
  let client: ClientBase;

  if (isClientBase(connection)) {
    client = connection;
  } else {
    ownClient = new pg.Client(connection);
    client = ownClient;
  }

  const isExternalClient = ownClient === undefined;

  let connectionStatus: ConnectionStatus = isExternalClient
    ? 'EXTERNAL'
    : 'DISCONNECTED';

  const beforeCloseListeners: Array<() => unknown> = [];

  const connected: DBConnection['connected'] = () =>
    connectionStatus === 'CONNECTED' || connectionStatus === 'EXTERNAL';

  const createConnection: DBConnection['createConnection'] = () =>
    new Promise<void>((resolve, reject) => {
      if (connected()) {
        resolve();
      } else if (connectionStatus === 'ERROR') {
        reject(
          new Error('Connection already failed, do not try to connect again')
        );
      } else {
        client.connect((err: Error | null) => {
          if (err) {
            connectionStatus = 'ERROR';
            logger.error(`could not connect to postgres: ${inspect(err)}`);
            reject(err);
            return;
          }

          connectionStatus = 'CONNECTED';
          resolve();
        });
      }
    });

  const query: DBConnection['query'] = async (
    queryTextOrConfig: string | QueryConfig | QueryArrayConfig,
    values?: any[]
  ): Promise<QueryArrayResult | QueryResult> => {
    await createConnection();
    try {
      return await client.query(queryTextOrConfig, values);
    } catch (error: any) {
      const string: string =
        typeof queryTextOrConfig === 'string'
          ? queryTextOrConfig
          : queryTextOrConfig.text;

      logger.error(formatQueryError(string, error));

      throw error;
    }
  };

  const select: DBConnection['select'] = async (
    queryTextOrConfig: string | QueryConfig | QueryArrayConfig,
    values?: any[]
  ) => {
    const { rows }: { rows: unknown[] } = await query(
      queryTextOrConfig,
      values
    );

    return rows;
  };

  const column: DBConnection['column'] = async (
    columnName: string,
    queryTextOrConfig: string | QueryConfig | QueryArrayConfig,
    values?: any[]
  ) => {
    const rows: Array<Record<string, unknown>> = await select(
      queryTextOrConfig,
      values
    );

    return rows.map((r) => r[columnName]);
  };

  return {
    createConnection,
    query,
    select,
    column,

    connected,
    addBeforeCloseListener: (listener) => beforeCloseListeners.push(listener),
    close: async () => {
      await beforeCloseListeners.reduce<Promise<unknown>>(
        (promise, listener) =>
          promise.then(listener).catch((error: any) => {
            logger.error(error.stack || error);
          }),
        Promise.resolve()
      );
      if (!isExternalClient) {
        connectionStatus = 'DISCONNECTED';
        await ownClient?.end();
      }
    },
  };
}
