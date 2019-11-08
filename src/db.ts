/*
 This file just manages the database connection and provides a query method
 */

import {
  Client,
  ClientConfig,
  QueryArrayResult,
  QueryResult,
  QueryArrayConfig,
  QueryConfig,
} from 'pg';
// or native libpq bindings
// const pg = require('pg/native');

// see ClientBase in @types/pg
export interface DB {
  createConnection(): Promise<void>;

  query(queryConfig: QueryArrayConfig, values?: any[]): Promise<QueryArrayResult>;
  query(queryConfig: QueryConfig): Promise<QueryResult>;
  query(queryTextOrConfig: string | QueryConfig, values?: any[]): Promise<QueryResult>;

  select(queryConfig: QueryArrayConfig, values?: any[]): Promise<any[][]>;
  select(queryConfig: QueryConfig): Promise<any[][]>;
  select(queryTextOrConfig: string | QueryConfig, values?: any[]): Promise<any[][]>;

  column(columnName: 'name',queryConfig: QueryArrayConfig, values?: any[]): Promise<any[]>;
  column(columnName: 'name',queryConfig: QueryConfig): Promise<any[]>;
  column(columnName: 'name',queryTextOrConfig: string | QueryConfig, values?: any[]): Promise<any[]>;

  addBeforeCloseListener: (listener: any) => number;
  close(): Promise<void>;
}

const db = (
  connection: Client | string | ClientConfig,
  log = console.error
): DB => {
  const isExternalClient = connection instanceof Client;
  let clientActive = false;

  const client: Client = isExternalClient
    ? (connection as Client)
    : new Client(connection as string | ClientConfig);

  const beforeCloseListeners: any[] = [];

  const createConnection: () => Promise<void> = () =>
    new Promise((resolve, reject) =>
      clientActive || isExternalClient
        ? resolve()
        : client.connect(err => {
            if (err) {
              log('could not connect to postgres', err);
              return reject(err);
            }
            clientActive = true;
            return resolve();
          })
    );

  const query: DB['query'] = async (
    queryTextOrConfig: string | QueryConfig | QueryArrayConfig,
    values?: any[],
  ): Promise<QueryArrayResult | QueryResult> => {
    await createConnection();
    try {
      return await client.query(queryTextOrConfig, values);
    } catch (err) {
      const { message, position }: { message: string; position: number } = err;
      const string: string = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
      if (message && position >= 1) {
        const endLineWrapIndexOf = string.indexOf('\n', position);
        const endLineWrapPos =
          endLineWrapIndexOf >= 0 ? endLineWrapIndexOf : string.length;
        const stringStart = string.substring(0, endLineWrapPos);
        const stringEnd = string.substr(endLineWrapPos);
        const startLineWrapPos = stringStart.lastIndexOf('\n') + 1;
        const padding = ' '.repeat(position - startLineWrapPos - 1);
        log(`Error executing:
${stringStart}
${padding}^^^^${stringEnd}

${message}
`);
      } else {
        log(`Error executing:
${string}
${err}
`);
      }
      throw err;
    }
  };

  const select: DB['select'] = async (
    queryTextOrConfig: string | QueryConfig | QueryArrayConfig,
    values?: any[],
  ) => {
    const { rows } = await query(queryTextOrConfig, values);
    return rows;
  };
  const column: DB['column'] = async (
    columnName: string,
    queryTextOrConfig: string | QueryConfig | QueryArrayConfig,
    values?: any[],
  ) => {
    const rows = await select(queryTextOrConfig, values)
    return rows.map((r: { [key: string]: any }) => r[columnName]);
  }

  return {
    createConnection,
    query,
    select,
    column,

    addBeforeCloseListener: listener => beforeCloseListeners.push(listener),

    close: async () => {
      await beforeCloseListeners.reduce(
        (promise, listener) =>
          promise.then(listener).catch((err: any) => log(err.stack || err)),
        Promise.resolve()
      );
      if (!isExternalClient) {
        clientActive = false;
        client.end();
      }
    }
  };
};

export default db;
module.exports = db;
