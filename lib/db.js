/*
 This file just manages the database connection and provides a query method
 */

var pg = require('pg');
// or native libpq bindings
// var pg = require('pg').native

var client;
var client_active = false;

function createConnection(callback) {
  if (client_active) return callback();

  client.connect(function(err) {
    if (err) {
      console.error('could not connect to postgres', err);
      return callback(err);
    }
    client_active = true;
    callback();
  });
}

module.exports.init = function(connection_string) {
  if (!client) {
    client = new pg.Client(connection_string || process.env.DATABASE_URL);
  }
};

module.exports.query = function(query, callback) {
  createConnection(function(connErr) {
    if (connErr) return callback(connErr);

    // console.log('sql>> ' + query);
    client.query(query, function(queryErr, result) {
      if (queryErr) return callback(queryErr);
      return callback(null, result);
    });
  });
};

module.exports.close = function() {
  client_active = false;
  if (client) {
    client.end();
    client = null;
  }
};
