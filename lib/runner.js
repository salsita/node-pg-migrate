var async = require('async');
var Step = require('step');
var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var db = require('./db');
var Migration = require('./migration');

module.exports = function MigrationRunner(options){
  var self = this;

  var migrations = [];
  loadMigrationFiles();

  db.init(options.database_url);
  
  self.run = function(callback){
    var current_index, migrate_to_index;
    Step(
      function(){
        ensureMigrationTableExists(this);
      },
      function fetchCompletedMigrations(err){
        db.query("SELECT * FROM pgmigrations ORDER BY run_on", this)
      },
      function determineMigrationsToRun(err, result){
        if (err) return callback(err);
        if (!result || !result.rows) return callback(new Error('Unable to fetch migrations from pgmigrations table'));

        // TODO: handle merging of migrations that are out of order better
        // show a warning and add an option to apply missing migraitons

        // go through each existing migration and verify the file exists
        // store the index so we know where we are starting
        for (var i=0; i<result.rows.length; i++){
          // console.log( '"' + result.rows[i].name + '" -- "' + migrations[i].name + '"' );
          if ( result.rows[i].name !== migrations[i].name ){
            return callback(new Error('Migration file missing for already ran migration: '+result.rows[i].name))
          }
          if (options.file && options.file == migrations[i].name){
            migrate_to_index = i;
          }
        }
        current_index = result.rows.length;

        if (options.count){
          // infinity is set in the bin file
          if (options.count == Infinity){
            migrate_to_index = migrations.length;
          } else {
            // users can also specify the number of migrations to move up and down
            migrate_to_index = current_index + options.count * (options.direction=='up' ?1:-1);  
          }
        }

        // 0 is a clean slate (no migrations run)
        if (migrate_to_index < 0) return callback(new Error('cannot migrate past the starting position'));
        if (migrate_to_index > migrations.length ) return callback(new Error('Cannot migrate past the last migration defined'));
        if (current_index == migrate_to_index) {
          console.log('No migrations to run!');
          return callback();
        }

        var to_run;
        if (options.direction == 'up'){
          to_run = migrations.slice(current_index, migrate_to_index);
        } else {
          to_run = migrations.slice(migrate_to_index, current_index);
          to_run = to_run.reverse();
        }

        // TODO: add some fancy colors to logging
        var current_state_name = current_index == 0 ? 'CLEAN SLATE' : migrations[current_index-1].name;
        var new_state_name = migrate_to_index == 0 ? 'CLEAN SLATE' : migrations[migrate_to_index-1].name;
        console.log('> Migrating from '+current_state_name + ' >to> ' + new_state_name );

        this(null, to_run);
      },
      function runMigrations(err, migrations_to_run){
        if (err) return callback(err);
        async.eachSeries(migrations_to_run, function(m, next){
          if (options.direction == 'up') m.applyUp(next);
          else m.applyDown(next);
        }, this);
      },
      function finish(err){
        if (err) {
          console.log('> Rolling back attempted migration ...')
          return callback(err);
        }
        callback();
      }
    )
  }

  function loadMigrationFiles(){
    fs.readdirSync( options.dir + '/' ).forEach(function(file) {
      if (file.match(/.+\.js$/g) !== null && file !== 'index.js') {
        var name = file.replace('.js', '');
        // console.log( '> loading migration: '+name)
        var file_path = options.dir +'/'+ file;
        var actions = require( path.relative(__dirname, file_path) );
        var migration = new Migration( file_path, actions );
        migrations.push(migration);
      }
    });
    migrations = _.sortBy(migrations, 'name');
  }

}



function ensureMigrationTableExists(callback){
  Step(
    function checkIfTableExists(){
      db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pgmigrations'", this);
    },
    function createTableIfNecessary(err, result){
      if (err) return callback(err);
      if (result && result.rows && result.rows.length == 1) return callback();
      db.query('CREATE TABLE pgmigrations ( id SERIAL, name varchar(255) NOT NULL, run_on timestamp NOT NULL)', this);
    },
    function finish(err){
      if (err) return callback(err);
      return callback();
    }
  )
}
