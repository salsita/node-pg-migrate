/*
 This file just manages the database connection and provides a query method
 */

import {
  Client,
  ClientConfig,
  QueryArrayResult,
  QueryConfig,
  QueryResult,
  QueryResultRow
} from 'pg';
// or native libpq bindings
// const pg = require('pg/native');

// see ClientBase in @types/pg
export interface DB {
  createConnection(): Promise<void>;
  query(queryConfig: QueryConfig): Promise<QueryResult>;
  query<R extends QueryResultRow = any, I extends any[] = any[]>(
    queryTextOrConfig: string | QueryConfig<I>,
    values?: I[]
  ): Promise<QueryResult<R>>;
  select(queryConfig: QueryConfig): Promise<any[]>;
  select(
    queryTextOrConfig: string | QueryConfig,
    values?: any[]
  ): Promise<any[]>;
  column(columnName: 'name', ...args: string[]): Promise<any>;
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

  const query = async <R extends any[] = any[]>(
    ...args: any[]
  ): Promise<QueryArrayResult<R>> => {
    await createConnection();
    try {
      return await client.query(...args);
    } catch (err) {
      const { message, position }: { message: string; position: number } = err;
      const string: string = args[0].text || args[0];
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

  const select = async <T>(...args: T[]) => {
    const { rows } = await query(...args);
    return rows;
  };
  const column = async (columnName: string, ...args: string[]) =>
    (await select(...args)).map((r: { [key: string]: any }) => r[columnName]);

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
