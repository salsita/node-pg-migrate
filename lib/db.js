/*
  This file just manages the database connection and provides a query method
*/

var pg = require('pg');
//or native libpq bindings
//var pg = require('pg').native

var connection_string = process.env.DATABASE_URL;
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