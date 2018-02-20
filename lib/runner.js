import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import Db from './db';
import Migration from './migration';
import { getMigrationTableSchema, finallyPromise } from './utils';

export { PgLiteral } from './utils';

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
      Promise.all(files.map(file =>
        new Promise((resolve, reject) =>
          fs.lstat(`${options.dir}/${file}`, (err, stats) => (
            err
              ? reject(err)
              : resolve(stats.isFile() ? file : null)
          )))
      ))
    )
    .then((files) => {
      const filter = new RegExp(`^(${options.ignorePattern})$`);
      return files
        .filter(i => i && !filter.test(i))
        .map((file) => {
          const filePath = `${options.dir}/${file}`;
          // eslint-disable-next-line global-require,import/no-dynamic-require
          const actions = require(path.relative(__dirname, filePath));
          return new Migration(db, filePath, actions, options);
        })
        .sort((m1, m2) => (
          m1.name < m2.name // eslint-disable-line no-nested-ternary
            ? -1
            : m1.name > m2.name
              ? 1
              : 0
        ));
    })
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
                WHERE c.relname = '${options.migrationsTable}' and c.relkind = 'r' and n.nspname = '${schema}'`)
      .then((rows) => {
        if (rows.length > 1) {
          throw new Error('More then one migration table');
        } else if (rows.length === 1) {
          return rows[0].comment;
        }
        return null;
      });

  return db.query('BEGIN')
    .then(() => db.query(`LOCK "${schema}"."${options.migrationsTable}" IN ACCESS EXCLUSIVE MODE`))
    .then(getCurrentLockName)
    .then((currentLockName) => {
      if (currentLockName) {
        throw new Error('Another migration is already running');
      }
    })
    .then(() => db.query(`COMMENT ON TABLE "${schema}"."${options.migrationsTable}" IS '${lockName}'`))
    .then(() => db.query('COMMIT'));
};

const unlock = (db, options) => {
  const schema = getMigrationTableSchema(options);
  return db.query(`COMMENT ON TABLE "${schema}"."${options.migrationsTable}" IS NULL`);
};

const getRunMigrations = (db, options) => {
  const schema = getMigrationTableSchema(options);
  return db.select(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = '${options.migrationsTable}'`)
    .then(migrationTables =>
      (migrationTables && migrationTables.length === 1)
      || db.query(`CREATE TABLE "${schema}"."${options.migrationsTable}" ( id SERIAL, ${nameColumn} varchar(255) NOT NULL, ${runOnColumn} timestamp NOT NULL)`)
    )
    .then(() => (
      !options.noLock
        ? lock(db, options)
        : null
    ))
    .then(() => (
      !options.noLock
        ? db.addBeforeCloseListener(() => unlock(db, options))
        : null
    ))
    .then(() =>
      db.column(`SELECT ${nameColumn} FROM "${schema}"."${options.migrationsTable}" ORDER BY ${runOnColumn}`, nameColumn)
    )
    .catch((err) => {
      throw new Error(`Unable to fetch migrations: ${err.stack}`);
    });
};

const getMigrationsToRun = (options, runNames, migrations) => {
  if (options.direction === 'down') {
    const downMigrations = runNames
      .filter(migrationName => !options.file || options.file === migrationName)
      .map(migrationName =>
        migrations.find(({ name }) => name === migrationName) || migrationName
      );
    const toRun = (options.timestamp
      ? downMigrations.filter(({ timestamp }) => timestamp >= options.count)
      : downMigrations.slice(-Math.abs(options.count || 1))
    ).reverse();
    const deletedMigrations = toRun.filter(migration => typeof migration === 'string');
    if (deletedMigrations.length) {
      throw new Error(`Definitions of migrations ${deletedMigrations.join(', ')} have been deleted.`);
    }
    return toRun;
  }
  const upMigrations = migrations
    .filter(({ name }) =>
      runNames.indexOf(name) < 0 && (!options.file || options.file === name)
    );
  return (options.timestamp
    ? upMigrations.filter(({ timestamp }) => timestamp <= options.count)
    : upMigrations.slice(0, Math.abs(options.count || Infinity))
  );
};

export default (options) => {
  const db = Db(options.databaseUrl);
  return Promise.resolve()
    .then(() => {
      let promise = Promise.resolve();
      if (options.schema) {
        if (options.createSchema) {
          promise = promise.then(() => db.query(`CREATE SCHEMA IF NOT EXISTS '${options.schema}'`));
        }
        promise = promise.then(() => db.query(`SET SCHEMA '${options.schema}'`));
      }
      if (options.migrationsSchema && options.createMigrationsSchema) {
        promise = promise.then(() => db.query(`CREATE SCHEMA IF NOT EXISTS '${options.migrationsSchema}'`));
      }
      return promise;
    })
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
  const db = Db(options.databaseUrl);
  return unlock(db, options)
    .then(...finallyPromise(db.close));
};
