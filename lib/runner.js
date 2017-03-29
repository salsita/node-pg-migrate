var async = require('async');
var Step = require('step');
var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var db = require('./db');
var utils = require('./utils');
var Migration = require('./migration');

function loadMigrationFiles(options) {
  var migrations = [];
  fs.readdirSync(options.dir + '/').forEach(function(file) {
    if (file.match(/.+\.js$/g) !== null && file !== 'index.js') {
      var file_path = options.dir + '/' + file;
      var actions = require(path.relative(__dirname, file_path));
      var migration = new Migration(file_path, actions, options);
      migrations.push(migration);
    }
  });
  return _.sortBy(migrations, 'name');
}

function ensureMigrationTableExists(options, callback) {
  Step(
    function checkIfTableExists() {
      db.query(utils.t('SELECT table_name FROM information_schema.tables WHERE table_schema = \'{schema}\' AND table_name = \'{table}\'', {
        schema: options.migrations_schema,
        table: options.migrations_table,
      }), this);
    },
    function createTableIfNecessary(err, result) {
      if (err) return callback(err);
      if (result && result.rows && result.rows.length === 1) return callback();
      db.query(utils.t('CREATE TABLE "{schema}"."{table}" ( id SERIAL, name varchar(255) NOT NULL, run_on timestamp NOT NULL)', {
        schema: options.migrations_schema,
        table: options.migrations_table,
      }), this);
    },
    function finish(err) {
      if (err) return callback(err);
      return callback();
    }
  );
}

module.exports = function MigrationRunner(options) {
  var self = this;

  var migrations = loadMigrationFiles(options);

  self.run = function(callback) {
    function exitCallback(arg) {
      db.close();
      callback(arg);
    }

    Step(
      function() {
        db.init(options.database_url);
        this();
      },
      function() {
        ensureMigrationTableExists(options, this);
      },
      function fetchCompletedMigrations() {
        db.query(utils.t('SELECT * FROM "{schema}"."{table}" ORDER BY run_on', { schema: options.migrations_schema, table: options.migrations_table }), this);
      },
      function determineMigrationsToRun(err, result) {
        if (err) return exitCallback(err);
        if (!result || !result.rows) return exitCallback(new Error('Unable to fetch migrations from ' + options.migrations_schema + '.' + options.migrations_table + ' table'));

        // store done migration names
        var runNames = result.rows.map(function(row) {
          return row.name;
        });

        if (options.checkOrder) {
          var len = Math.min(runNames.length, migrations.length);
          for (var i = 0; i < len; i++) {
            if (runNames[i] !== migrations[i].name) {
              return exitCallback(new Error('Not run migration ' + migrations[i].name + ' is preceding already run migration ' + runNames[i]));
            }
          }
        }

        // final selection will go here
        var to_run;

        if (options.direction === 'down') {
          to_run = runNames
            .filter(function(migration_name) {
              return !options.file || options.file === migration_name;
            })
            .map(function(migration_name) {
              return migrations.find(function(migration) {
                return migration.name === migration_name;
              }) || migration_name;
            })
            .slice(-Math.abs(options.count || 1))
            .reverse();
          var deletedMigrations = to_run.filter(function(migration) {
            return typeof migration === 'string';
          });
          if (deletedMigrations.length) {
            return exitCallback(new Error('Definitions of migrations ' + deletedMigrations.join(', ') + ' have been deleted.'));
          }
        } else {
          to_run = migrations
            .filter(function(migration) {
              return runNames.indexOf(migration.name) < 0 && (!options.file || options.file === migration.name);
            })
            .slice(0, Math.abs(options.count || Infinity));
        }

        if (!to_run.length) {
          console.log('No migrations to run!');
          return exitCallback();
        }

        // TODO: add some fancy colors to logging
        console.log('> Migrating files:');
        to_run.forEach(function(m) {
          console.log('> - ' + m.name);
        });

        this(null, to_run);
      },
      function runMigrations(err, migrations_to_run) {
        if (err) return exitCallback(err);
        async.eachSeries(migrations_to_run, function(m, next) {
          if (options.direction === 'up') m.applyUp(next);
          else m.applyDown(next);
        }, this);
      },
      function finish(err) {
        if (err) {
          console.log('> Rolling back attempted migration ...');
          return exitCallback(err);
        }
        exitCallback();
      }
    );
  };
};


