import async from 'async';
import Step from 'step';
import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import Db from './db';
import Migration from './migration';

function loadMigrationFiles(db, options) {
  const migrations = [];
  fs.readdirSync(`${options.dir}/`).forEach((file) => {
    if (file.match(/.+\.js$/g) !== null && file !== 'index.js') {
      const file_path = `${options.dir}/${file}`;
      // eslint-disable-next-line global-require,import/no-dynamic-require
      const actions = require(path.relative(__dirname, file_path));
      const migration = new Migration(db, file_path, actions, options);
      migrations.push(migration);
    }
  });
  return _.sortBy(migrations, 'name');
}

function ensureMigrationTableExists(db, options, callback) {
  Step(
    function checkIfTableExists() {
      db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${options.migrations_schema}' AND table_name = '${options.migrations_table}'`, this);
    },
    function createTableIfNecessary(err, result) {
      if (err) {
        callback(err);
      } else if (result && result.rows && result.rows.length === 1) {
        callback();
      } else {
        db.query(`CREATE TABLE "${options.migrations_schema}"."${options.migrations_table}" ( id SERIAL, name varchar(255) NOT NULL, run_on timestamp NOT NULL)`, this);
      }
    },
    callback
  );
}

export default (options, callback) => {
  const db = Db(options.database_url);
  const migrations = loadMigrationFiles(db, options);

  function exitCallback(arg) {
    db.close();
    callback(arg);
  }

  Step(
    () => ensureMigrationTableExists(db, options, this),
    function fetchCompletedMigrations() {
      db.query(`SELECT * FROM "${options.migrations_schema}"."${options.migrations_table}" ORDER BY run_on`, this);
    },
    function determineMigrationsToRun(err, result) {
      if (err) return exitCallback(err);
      if (!result || !result.rows) return exitCallback(new Error(`Unable to fetch migrations from ${options.migrations_schema}.${options.migrations_table} table`));

      // store done migration names
      const runNames = result.rows.map(row => row.name);

      if (options.checkOrder) {
        for (let i = 0; i < runNames.length; i += 1) {
          if (runNames[i] !== migrations[i].name) {
            return exitCallback(new Error(`Not run migration ${migrations[i].name} is preceding already run migration ${runNames[i]}`));
          }
        }
      }

      // final selection will go here
      let to_run;

      if (options.direction === 'down') {
        to_run = runNames
          .filter(migration_name => !options.file || options.file === migration_name)
          .map(migration_name =>
            migrations.find(({ name }) => name === migration_name) || migration_name
          )
          .slice(-Math.abs(options.count || 1))
          .reverse();
        const deletedMigrations = to_run.filter(migration => typeof migration === 'string');
        if (deletedMigrations.length) {
          return exitCallback(new Error(`Definitions of migrations ${deletedMigrations.join(', ')} have been deleted.`));
        }
      } else {
        to_run = migrations
          .filter(({ name }) =>
            runNames.indexOf(name) < 0 && (!options.file || options.file === name)
          )
          .slice(0, Math.abs(options.count || Infinity));
      }

      if (!to_run.length) {
        console.log('No migrations to run!');
        return exitCallback();
      }

      // TODO: add some fancy colors to logging
      console.log('> Migrating files:');
      to_run.forEach((m) => {
        console.log(`> - ${m.name}`);
      });

      return this(null, to_run);
    },
    function runMigrations(err, migrations_to_run) {
      if (err) {
        exitCallback(err);
      } else {
        async.eachSeries(migrations_to_run, (m, next) => {
          if (options.direction === 'up') m.applyUp(next);
          else m.applyDown(next);
        }, this);
      }
    },
    (err) => {
      if (err) {
        console.log('> Rolling back attempted migration ...');
      }
      exitCallback(err);
    }
  );
};
