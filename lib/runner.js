import path from "path";
import crypto from "crypto";
import fs from "fs";
import Db from "./db";
import Migration from "./migration";
import { getMigrationTableSchema, finallyPromise, template } from "./utils";

export { PgLiteral } from "./utils";

const readdir = (...args) =>
  new Promise(
    (resolve, reject) =>
      fs.readdir(...args, (err, files) => (err ? reject(err) : resolve(files))) // eslint-disable-line security/detect-non-literal-fs-filename
  );
const nameColumn = "name";
const runOnColumn = "run_on";

const loadMigrationFiles = (db, options, log) =>
  readdir(`${options.dir}/`)
    .then(files =>
      Promise.all(
        files.map(
          file =>
            new Promise((resolve, reject) =>
              // eslint-disable-next-line security/detect-non-literal-fs-filename
              fs.lstat(
                `${options.dir}/${file}`,
                (err, stats) =>
                  err ? reject(err) : resolve(stats.isFile() ? file : null)
              )
            )
        )
      )
    )
    .then(files => {
      const filter = new RegExp(`^(${options.ignorePattern})$`); // eslint-disable-line security/detect-non-literal-regexp
      let shorthands = {};
      return files
        .filter(i => i && !filter.test(i))
        .sort(
          (f1, f2) =>
            f1 < f2 // eslint-disable-line no-nested-ternary
              ? -1
              : f1 > f2 ? 1 : 0
        )
        .map(file => {
          const filePath = `${options.dir}/${file}`;
          // eslint-disable-next-line global-require,import/no-dynamic-require,security/detect-non-literal-require
          const actions = require(path.relative(__dirname, filePath));
          shorthands = { ...shorthands, ...actions.shorthands };
          return new Migration(
            db,
            filePath,
            actions,
            options,
            {
              ...shorthands
            },
            log
          );
        });
    })
    .catch(err => {
      throw new Error(`Can't get migration files: ${err.stack}`);
    });

const lock = (db, options) => {
  const schema = getMigrationTableSchema(options);
  const { migrationsTable } = options;
  const fullTableName = {
    schema,
    name: migrationsTable
  };
  const lockName = crypto.randomBytes(30).toString("base64");
  const getCurrentLockName = () =>
    db
      .select(
        `SELECT obj_description(c.oid) as "comment"
                FROM pg_class c join pg_namespace n ON (c.relnamespace = n.oid)
                WHERE c.relname = '${migrationsTable}' and c.relkind = 'r' and n.nspname = '${schema}'`
      )
      .then(rows => {
        if (rows.length > 1) {
          throw new Error("More then one migration table");
        } else if (rows.length === 1) {
          return rows[0].comment;
        }
        return null;
      });

  return db
    .query("BEGIN")
    .then(() =>
      db.query(template`LOCK "${fullTableName}" IN ACCESS EXCLUSIVE MODE`)
    )
    .then(getCurrentLockName)
    .then(currentLockName => {
      if (currentLockName) {
        throw new Error("Another migration is already running");
      }
    })
    .then(() =>
      db.query(template`COMMENT ON TABLE "${fullTableName}" IS '${lockName}'`)
    )
    .then(() => db.query("COMMIT"));
};

const unlock = (db, options) => {
  const schema = getMigrationTableSchema(options);
  const fullTableName = {
    schema,
    name: options.migrationsTable
  };
  return db.query(template`COMMENT ON TABLE "${fullTableName}" IS NULL`);
};

const getRunMigrations = (db, options) => {
  const schema = getMigrationTableSchema(options);
  const { migrationsTable } = options;
  const fullTableName = {
    schema,
    name: migrationsTable
  };
  return db
    .select(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = '${migrationsTable}'`
    )
    .then(
      migrationTables =>
        (migrationTables && migrationTables.length === 1) ||
        db.query(
          template`CREATE TABLE "${fullTableName}" ( id SERIAL, ${nameColumn} varchar(255) NOT NULL, ${runOnColumn} timestamp NOT NULL)`
        )
    )
    .then(() => (!options.noLock ? lock(db, options) : null))
    .then(
      () =>
        !options.noLock
          ? db.addBeforeCloseListener(() => unlock(db, options))
          : null
    )
    .then(() =>
      db.column(
        template`SELECT ${nameColumn} FROM "${fullTableName}" ORDER BY ${runOnColumn}`,
        nameColumn
      )
    )
    .catch(err => {
      throw new Error(`Unable to fetch migrations: ${err.stack}`);
    });
};

const getMigrationsToRun = (options, runNames, migrations) => {
  if (options.direction === "down") {
    const downMigrations = runNames
      .filter(migrationName => !options.file || options.file === migrationName)
      .map(
        migrationName =>
          migrations.find(({ name }) => name === migrationName) || migrationName
      );
    const toRun = (options.timestamp
      ? downMigrations.filter(({ timestamp }) => timestamp >= options.count)
      : downMigrations.slice(
          -Math.abs(options.count === undefined ? 1 : options.count)
        )
    ).reverse();
    const deletedMigrations = toRun.filter(
      migration => typeof migration === "string"
    );
    if (deletedMigrations.length) {
      const deletedMigrationsStr = deletedMigrations.join(", ");
      throw new Error(
        `Definitions of migrations ${deletedMigrationsStr} have been deleted.`
      );
    }
    return toRun;
  }
  const upMigrations = migrations.filter(
    ({ name }) =>
      runNames.indexOf(name) < 0 && (!options.file || options.file === name)
  );
  return options.timestamp
    ? upMigrations.filter(({ timestamp }) => timestamp <= options.count)
    : upMigrations.slice(
        0,
        Math.abs(options.count === undefined ? Infinity : options.count)
      );
};

const ifSingleTransaction = (operation, options, db) =>
  options.singleTransaction === false ? Promise.resolve() : db.query(operation);

export default options => {
  const log = options.log || console.log;
  const db = Db(options.databaseUrl);
  return Promise.resolve()
    .then(() => {
      let promise = Promise.resolve();
      if (options.schema) {
        if (options.createSchema) {
          promise = promise.then(() =>
            db.query(`CREATE SCHEMA IF NOT EXISTS "${options.schema}"`)
          );
        }
        promise = promise.then(() =>
          db.query(`SET SCHEMA '${options.schema}'`)
        );
      }
      if (options.migrationsSchema && options.createMigrationsSchema) {
        promise = promise.then(() =>
          db.query(`CREATE SCHEMA IF NOT EXISTS "${options.migrationsSchema}"`)
        );
      }
      return promise;
    })
    .then(() =>
      Promise.all([
        loadMigrationFiles(db, options, log),
        getRunMigrations(db, options)
      ])
    )
    .then(([migrations, runNames]) => {
      if (options.checkOrder) {
        const len = Math.min(runNames.length, migrations.length);
        for (let i = 0; i < len; i += 1) {
          const runName = runNames[i];
          const migrationName = migrations[i].name;
          if (runName !== migrationName) {
            throw new Error(
              `Not run migration ${migrationName} is preceding already run migration ${runName}`
            );
          }
        }
      }

      const toRun = getMigrationsToRun(options, runNames, migrations);

      if (!toRun.length) {
        log("No migrations to run!");
        return null;
      }

      // TODO: add some fancy colors to logging
      log("> Migrating files:");
      toRun.forEach(m => {
        log(`> - ${m.name}`);
      });

      return ifSingleTransaction("BEGIN", options, db)
        .then(() =>
          toRun.reduce(
            (promise, migration) =>
              promise.then(
                () =>
                  options.direction === "up"
                    ? migration.applyUp()
                    : migration.applyDown()
              ),
            Promise.resolve()
          )
        )
        .then(() => ifSingleTransaction("COMMIT", options, db));
    })
    .catch(e => {
      log("> Rolling back attempted migration ...");
      return db.query("ROLLBACK").then(
        ...finallyPromise(() => {
          throw e;
        })
      );
    })
    .then(...finallyPromise(db.close));
};

export const unlockRunner = options => {
  const db = Db(options.databaseUrl);
  return unlock(db, options).then(...finallyPromise(db.close));
};
