/*
 This file just manages the database connection and provides a query method
 */

const pg = require("pg");
// or native libpq bindings
// const pg = require("pg/native");

module.exports = (connection, log = console.error) => {
  const isExternalClient = connection instanceof pg.Client;
  let clientActive = false;

  const client = isExternalClient ? connection : new pg.Client(connection);

  const beforeCloseListeners = [];

  const createConnection = () =>
    new Promise((resolve, reject) =>
      clientActive || isExternalClient
        ? resolve()
        : client.connect(err => {
            if (err) {
              log("could not connect to postgres", err);
              return reject(err);
            }
            clientActive = true;
            return resolve();
          })
    );

  const query = async (...args) => {
    await createConnection();
    try {
      return await client.query(...args);
    } catch (err) {
      const { message, position } = err;
      const string = args[0].text || args[0];
      if (message && position >= 1) {
        const endLineWrapIndexOf = string.indexOf("\n", position);
        const endLineWrapPos =
          endLineWrapIndexOf >= 0 ? endLineWrapIndexOf : string.length;
        const stringStart = string.substring(0, endLineWrapPos);
        const stringEnd = string.substr(endLineWrapPos);
        const startLineWrapPos = stringStart.lastIndexOf("\n") + 1;
        const padding = " ".repeat(position - startLineWrapPos - 1);
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

  const select = async (...args) => {
    const { rows } = await query(...args);
    return rows;
  };
  const column = async (columnName, ...args) =>
    (await select(...args)).map(r => r[columnName]);

  return {
    query,
    select,
    column,

    addBeforeCloseListener: listener => beforeCloseListeners.push(listener),

    close: async () => {
      await beforeCloseListeners.reduce(
        (promise, listener) =>
          promise.then(listener).catch(err => log(err.stack || err)),
        Promise.resolve()
      );
      if (!isExternalClient) {
        clientActive = false;
        client.end();
      }
    }
  };
};
