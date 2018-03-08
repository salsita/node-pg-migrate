/*
 This file just manages the database connection and provides a query method
 */

import pg from 'pg';
// or native libpq bindings
// import pg from 'pg/native';

export default (connectionString, log = console.error) => {
  const client = new pg.Client(connectionString);
  let clientActive = false;
  const beforeCloseListeners = [];

  const createConnection = () => (
    clientActive
      ? Promise.resolve()
      : client.connect()
        .then(() => {
          clientActive = true;
        })
        .catch((err) => {
          log('could not connect to postgres', err);
          throw err;
        })
  );

  const query = (...args) =>
    createConnection()
      .then(() =>
        client.query(...args)
      )
      .catch((err) => {
        const { message, position } = err;
        const string = args[0].text || args[0];
        if (message && position >= 1) {
          const endLineWrapIndexOf = string.indexOf('\n', position);
          const endLineWrapPos = endLineWrapIndexOf >= 0 ? endLineWrapIndexOf : string.length;
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
      });

  const select = string =>
    query(string)
      .then(result => result && result.rows);
  const column = (string, columnName) =>
    select(string)
      .then(rows => rows.map(r => r[columnName]));

  return {
    query,
    select,
    column,

    addBeforeCloseListener: listener => beforeCloseListeners.push(listener),

    close: () =>
      beforeCloseListeners
        .reduce(
          (promise, listener) =>
            promise
              .then(listener)
              .catch(err =>
                log(err.stack || err)
              ),
          Promise.resolve()
        )
        .then(() => {
          clientActive = false;
          if (client) {
            client.end();
          }
        }),
  };
};
