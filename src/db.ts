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

// This file just manages the database connection and provides a query method

// see ClientBase in @types/pg
export interface DB {
  /* eslint-disable @typescript-eslint/no-explicit-any */
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
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/* eslint-disable @typescript-eslint/no-explicit-any */
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

export function db(
  connection: ClientBase | string | ClientConfig,
  logger: Logger = console
): DBConnection {
  const isExternalClient =
    typeof connection === 'object' &&
    'query' in connection &&
    typeof connection.query === 'function';

  const client: Client = isExternalClient
    ? (connection as Client)
    : new pg.Client(connection as string | ClientConfig);

  let connectionStatus: ConnectionStatus = isExternalClient
    ? 'EXTERNAL'
    : 'DISCONNECTED';

  const beforeCloseListeners: any[] = [];

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
        client.connect((err) => {
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
      const { message, position }: { message: string; position: number } =
        error;

      const string: string =
        typeof queryTextOrConfig === 'string'
          ? queryTextOrConfig
          : queryTextOrConfig.text;

      if (message && position >= 1) {
        const endLineWrapIndexOf = string.indexOf('\n', position);
        const endLineWrapPos =
          endLineWrapIndexOf >= 0 ? endLineWrapIndexOf : string.length;
        const stringStart = string.slice(0, endLineWrapPos);
        const stringEnd = string.slice(endLineWrapPos);
        const startLineWrapPos = stringStart.lastIndexOf('\n') + 1;
        const padding = ' '.repeat(position - startLineWrapPos - 1);
        logger.error(`Error executing:
${stringStart}
${padding}^^^^${stringEnd}

${message}
`);
      } else {
        logger.error(`Error executing:
${string}
${error}
`);
      }

      throw error;
    }
  };

  const select: DBConnection['select'] = async (
    queryTextOrConfig: string | QueryConfig | QueryArrayConfig,
    values?: any[]
  ) => {
    const { rows } = await query(queryTextOrConfig, values);
    return rows;
  };

  const column: DBConnection['column'] = async (
    columnName: string,
    queryTextOrConfig: string | QueryConfig | QueryArrayConfig,
    values?: any[]
  ) => {
    const rows = await select(queryTextOrConfig, values);
    return rows.map((r: { [key: string]: any }) => r[columnName]);
  };

  return {
    createConnection,
    query,
    select,
    column,

    connected,
    addBeforeCloseListener: (listener) => beforeCloseListeners.push(listener),
    close: async () => {
      await beforeCloseListeners.reduce(
        (promise, listener) =>
          promise.then(listener).catch((error: any) => {
            logger.error(error.stack || error);
          }),
        Promise.resolve()
      );
      if (!isExternalClient) {
        connectionStatus = 'DISCONNECTED';
        client.end();
      }
    },
  };
}
