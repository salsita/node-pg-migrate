/*
 This file just manages the database connection and provides a query method
 */
import { inspect } from 'util'
import { ClientBase, Client, ClientConfig, QueryArrayResult, QueryResult, QueryArrayConfig, QueryConfig } from 'pg'
import { Logger, DB } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DBConnection extends DB {
  createConnection(): Promise<void>

  column(columnName: string, queryConfig: QueryArrayConfig, values?: any[]): Promise<any[]>
  column(columnName: string, queryConfig: QueryConfig): Promise<any[]>
  column(columnName: string, queryTextOrConfig: string | QueryConfig, values?: any[]): Promise<any[]>

  connected: () => boolean
  addBeforeCloseListener: (listener: any) => number
  close(): Promise<void>
}

enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

const db = (connection: ClientBase | string | ClientConfig, logger: Logger = console): DBConnection => {
  const isExternalClient =
    typeof connection === 'object' && 'query' in connection && typeof connection.query === 'function'
  let connectionStatus = ConnectionStatus.DISCONNECTED

  const client: Client = isExternalClient ? (connection as Client) : new Client(connection as string | ClientConfig)

  const beforeCloseListeners: any[] = []

  const createConnection: () => Promise<void> = () =>
    new Promise((resolve, reject) => {
      if (isExternalClient || connectionStatus === ConnectionStatus.CONNECTED) {
        resolve()
      } else if (connectionStatus === ConnectionStatus.ERROR) {
        reject(new Error('Connection already failed, do not try to connect again'))
      } else {
        client.connect((err) => {
          if (err) {
            connectionStatus = ConnectionStatus.ERROR
            logger.error(`could not connect to postgres: ${inspect(err)}`)
            return reject(err)
          }
          connectionStatus = ConnectionStatus.CONNECTED
          return resolve()
        })
      }
    })

  const query: DBConnection['query'] = async (
    queryTextOrConfig: string | QueryConfig | QueryArrayConfig,
    values?: any[],
  ): Promise<QueryArrayResult | QueryResult> => {
    await createConnection()
    try {
      return await client.query(queryTextOrConfig, values)
    } catch (err) {
      const { message, position }: { message: string; position: number } = err
      const string: string = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text
      if (message && position >= 1) {
        const endLineWrapIndexOf = string.indexOf('\n', position)
        const endLineWrapPos = endLineWrapIndexOf >= 0 ? endLineWrapIndexOf : string.length
        const stringStart = string.substring(0, endLineWrapPos)
        const stringEnd = string.substr(endLineWrapPos)
        const startLineWrapPos = stringStart.lastIndexOf('\n') + 1
        const padding = ' '.repeat(position - startLineWrapPos - 1)
        logger.error(`Error executing:
${stringStart}
${padding}^^^^${stringEnd}

${message}
`)
      } else {
        logger.error(`Error executing:
${string}
${err}
`)
      }
      throw err
    }
  }

  const select: DBConnection['select'] = async (
    queryTextOrConfig: string | QueryConfig | QueryArrayConfig,
    values?: any[],
  ) => {
    const { rows } = await query(queryTextOrConfig, values)
    return rows
  }
  const column: DBConnection['column'] = async (
    columnName: string,
    queryTextOrConfig: string | QueryConfig | QueryArrayConfig,
    values?: any[],
  ) => {
    const rows = await select(queryTextOrConfig, values)
    return rows.map((r: { [key: string]: any }) => r[columnName])
  }

  return {
    createConnection,
    query,
    select,
    column,

    connected: () => connectionStatus === ConnectionStatus.CONNECTED,
    addBeforeCloseListener: (listener) => beforeCloseListeners.push(listener),
    close: async () => {
      await beforeCloseListeners.reduce(
        (promise, listener) => promise.then(listener).catch((err: any) => logger.error(err.stack || err)),
        Promise.resolve(),
      )
      if (!isExternalClient) {
        connectionStatus = ConnectionStatus.DISCONNECTED
        client.end()
      }
    },
  }
}

export default db
