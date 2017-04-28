/*
 This file just manages the database connection and provides a query method
 */

import pg from 'pg';
// or native libpq bindings
// import pg from 'pg/native';

export default (connection_string) => {
  const client = new pg.Client(connection_string);
  let client_active = false;

  const createConnection = () =>
    new Promise((resolve, reject) => (
      client_active
        ? resolve()
        : client.connect((err) => {
          if (err) {
            console.error('could not connect to postgres', err);
            reject(err);
          } else {
            client_active = true;
            resolve();
          }
        })
    ));

  const query = string =>
    createConnection()
      .then(() =>
        new Promise((resolve, reject) =>
          client.query(string, (err, result) => (
            err
              ? reject(err)
              : resolve(result)
          ))
        )
      );

  const select = string =>
    query(string)
      .then(result => result && result.rows);
  const column = (string, column_name) =>
    select(string)
      .then(rows => rows.map(r => r[column_name]));

  return {
    query,
    select,
    column,

    close: () => {
      client_active = false;
      if (client) {
        client.end();
      }
    },
  };
};
