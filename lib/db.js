/*
 This file just manages the database connection and provides a query method
 */

import pg from 'pg';
// or native libpq bindings
// import pg from 'pg/native';

export default (connection_string) => {
  const client = new pg.Client(connection_string);
  let client_active = false;

  const createConnection = callback => (
    client_active
      ? callback()
      : client.connect((err) => {
        if (err) {
          console.error('could not connect to postgres', err);
        } else {
          client_active = true;
        }
        callback(err);
      })
  );

  return {
    query: (query, callback) => {
      createConnection(connErr => (
        connErr
          ? callback(connErr)
          : client.query(query, callback)
      ));
    },

    close: () => {
      client_active = false;
      if (client) {
        client.end();
      }
    },
  };
};
