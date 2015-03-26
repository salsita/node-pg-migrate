/*
  This file just manages the database connection and provides a query method
*/

var pg = require('pg');
//or native libpq bindings
//var pg = require('pg').native

// Load config (and suppress the no-config-warning)
process.env.SUPPRESS_NO_CONFIG_WARNING = 1;
var config = require('config');

// If we have the `db.` available in config then construct the URL; else
// use the URL from the environment
var connection_string;
if (config.has("db")) {
  var creds = "";
  if (config.has("db.user")) creds += config.get("db.user");
  if (config.has("db.password")) creds += ":" + config.get("db.password");

  var host = config.db.host || "localhost";
  var port = config.db.port || "5432";

  connection_string = (
    "postgres://" +
    (creds.length ? creds + "@" : "") + host +
    ":" + port +
    "/" + config.get("db.name"));
} else {
  connection_string = process.env.DATABASE_URL;
}

var client;
var client_active = false;

module.exports.init = function(conenction_string){
  client = new pg.Client(connection_string);
}

module.exports.query = function(query, callback){
  createConnection(function(err){
    if (err) return callback(err);

    // console.log('sql>> ' + query);
    client.query(query, function(err, result){
      if (err) return callback(err);
      return callback(null, result);
    });

  });
}

module.exports.close = function(){
  client.end();
}

function createConnection(callback){
  if (client_active) return callback();
  client.connect(function(err){
    if (err) {
      console.error('could not connect to postgres', err);
      return callback(err);
    }
    client_active = true;
    callback();
  });
}
