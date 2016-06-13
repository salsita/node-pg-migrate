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
        db.query("SELECT * FROM "+options.migrations_table+" ORDER BY run_on", this)
      },
      function determineMigrationsToRun(err, result) {
        if(err) return callback(err);
        if(!result || !result.rows) return callback(new Error('Unable to fetch migrations from pgmigrations table'));

        //store done migration names
        var runNames = result.rows.map(function(row) {
          return row.name;
        });

        var doneMigrations = [];
        var runMigrations = [];

        //filter out undone and done migrations from list of files
        for(var i = 0; i < migrations.length; i++) {
          if(runNames.indexOf(migrations[i].name) < 0) {

            //if specific migration file is requested
            if(options.file && options.file == migrations[i].name) {
              runMigrations = [migrations[i]];
              break;
            }
            runMigrations.push(migrations[i]);
          } else {
            doneMigrations.push(migrations[i])
          }

        }

        //final selection will go here
        var to_run;

        //down gets by default one migration at the time, if not set otherwise
        if(options.direction == 'down') {
          to_run = doneMigrations.slice(-1);
          //up gets all undone migrations by default
        } else {
          to_run = runMigrations;
        }

        //if specific count of migrations is requested
        if(options.count) {
          // infinity is set in the bin file
          if(options.count !== Infinity) {
            if(options.direction == 'up') {
              to_run = runMigrations.slice(0, options.count);
            } else {
              to_run = doneMigrations.slice(options.count * -1).reverse();
            }
          }
        }

        if(!to_run.length) {
          console.log('No migrations to run!');
          return callback();
        }

        // TODO: add some fancy colors to logging
        console.log('> Migrating files:');
        for(var i in to_run) {
          console.log('> - ' + to_run[i].name);
        }

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
        var migration = new Migration( file_path, actions, options );
        migrations.push(migration);
      }
    });
    migrations = _.sortBy(migrations, 'name');
  }


  function ensureMigrationTableExists(callback){
    Step(
      function checkIfTableExists(){
        db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '"+options.migrations_table+"'", this);
      },
      function createTableIfNecessary(err, result){
        if (err) return callback(err);
        if (result && result.rows && result.rows.length == 1) return callback();
        db.query('CREATE TABLE '+options.migrations_table+' ( id SERIAL, name varchar(255) NOT NULL, run_on timestamp NOT NULL)', this);
      },
      function finish(err){
        if (err) return callback(err);
        return callback();
      }
    )
  }


}


