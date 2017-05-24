import _ from 'lodash';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import Db from './db';
import Migration from './migration';
import { getMigrationTableSchema, finallyPromise } from './utils';

const readdir = (...args) =>
  new Promise((resolve, reject) =>
    fs.readdir(
      ...args,
      (err, files) => (
        err
          ? reject(err)
          : resolve(files)
      )
    )
  );
const nameColumn = 'name';
const runOnColumn = 'run_on';

const loadMigrationFiles = (db, options) =>
  readdir(`${options.dir}/`)
    .then(files =>
      _.chain(files)
        .filter(file => file.match(/.+\.js$/g) !== null && file !== 'index.js')
        .map((file) => {
          const file_path = `${options.dir}/${file}`;
          // eslint-disable-next-line global-require,import/no-dynamic-require
          const actions = require(path.relative(__dirname, file_path));
          return new Migration(db, file_path, actions, options);
        })
        .sortBy('name')
        .value()
    )
    .catch((err) => {
      throw new Error(`Can't get migration files: ${err.stack}`);
    });

const lock = (db, options) => {
  const schema = getMigrationTableSchema(options);
  const lockName = crypto.randomBytes(30).toString('base64');
  const getCurrentLockName = () =>
    db
      .select(`SELECT obj_description(c.oid) as "comment"
                FROM pg_class c join pg_namespace n ON (c.relnamespace = n.oid)
                WHERE c.relname = '${options.migrations_table}' and c.relkind = 'r' and n.nspname = '${schema}'`)
      .then((rows) => {
        if (rows.length > 1) {
          throw new Error('More then one migration table');
        } else if (rows.length === 1) {
          return rows[0].comment;
        }
        return null;
      });

  return db.query(`BEGIN`)
    .then(() => db.query(`LOCK "${schema}"."${options.migrations_table}" IN ACCESS EXCLUSIVE MODE`))
    .then(getCurrentLockName)
    .then((currentLockName) => {
      if (currentLockName) {
        throw new Error('Another migration is already running');
      }
    })
    .then(() => db.query(`COMMENT ON TABLE "${schema}"."${options.migrations_table}" IS '${lockName}'`))
    .then(() => db.query(`COMMIT`));
};

const unlock = (db, options) => {
  const schema = getMigrationTableSchema(options);
  return db.query(`COMMENT ON TABLE "${schema}"."${options.migrations_table}" IS NULL`);
};

const getRunMigrations = (db, options) => {
  const schema = getMigrationTableSchema(options);
  return db.select(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = '${options.migrations_table}'`)
    .then(migrationTables =>
      (migrationTables && migrationTables.length === 1)
      || db.query(`CREATE TABLE "${schema}"."${options.migrations_table}" ( id SERIAL, ${nameColumn} varchar(255) NOT NULL, ${runOnColumn} timestamp NOT NULL)`)
    )
    .then(() =>
      lock(db, options)
    )
    .then(() =>
      db.addBeforeCloseListener(() => unlock(db, options))
    )
    .then(() =>
      db.column(`SELECT ${nameColumn} FROM "${schema}"."${options.migrations_table}" ORDER BY ${runOnColumn}`, nameColumn)
    )
    .catch((err) => {
      throw new Error(`Unable to fetch migrations: ${err.stack}`);
    });
};

const getMigrationsToRun = (options, runNames, migrations) => {
  if (options.direction === 'down') {
    const toRun = runNames
      .filter(migration_name => !options.file || options.file === migration_name)
      .map(migration_name =>
        migrations.find(({ name }) => name === migration_name) || migration_name
      )
      .slice(-Math.abs(options.count || 1))
      .reverse();
    const deletedMigrations = toRun.filter(migration => typeof migration === 'string');
    if (deletedMigrations.length) {
      throw new Error(`Definitions of migrations ${deletedMigrations.join(', ')} have been deleted.`);
    }
    return toRun;
  }
  return migrations
    .filter(({ name }) =>
      runNames.indexOf(name) < 0 && (!options.file || options.file === name)
    )
    .slice(0, Math.abs(options.count || Infinity));
};

export default (options) => {
  const db = Db(options.database_url);
  return Promise.resolve()
    .then(() => (
      options.schema
        ? db.query(`SET SCHEMA '${options.schema}'`)
        : null
    ))
    .then(() =>
      Promise
        .all([
          loadMigrationFiles(db, options),
          getRunMigrations(db, options),
        ])
    )
    .then(([migrations, runNames]) => {
      if (options.checkOrder) {
        const len = Math.min(runNames.length, migrations.length);
        for (let i = 0; i < len; i += 1) {
          if (runNames[i] !== migrations[i].name) {
            throw new Error(`Not run migration ${migrations[i].name} is preceding already run migration ${runNames[i]}`);
          }
        }
      }

      const toRun = getMigrationsToRun(options, runNames, migrations);

      if (!toRun.length) {
        console.log('No migrations to run!');
        return null;
      }

      // TODO: add some fancy colors to logging
      console.log('> Migrating files:');
      toRun.forEach((m) => {
        console.log(`> - ${m.name}`);
      });

      return toRun.reduce(
        (promise, migration) => promise.then(() => (
          options.direction === 'up'
            ? migration.applyUp()
            : migration.applyDown()
        )),
        Promise.resolve()
      );
    })
    .catch((e) => {
      console.log('> Rolling back attempted migration ...');
      return db.query('ROLLBACK')
        .then(...finallyPromise(() => {
          throw e;
        }));
    })
    .then(...finallyPromise(db.close));
};

export const unlockRunner = (options) => {
  const db = Db(options.database_url);
  return unlock(db, options)
    .then(...finallyPromise(db.close));
};
