import path from "path";
import fs from "fs";
import Db from "./db";
import Migration from "./migration";
import { getMigrationTableSchema, finallyPromise, template } from "./utils";

export { PgLiteral } from "./utils";

// Random but well-known identifier shared by all instances of node-pg-migrate
const PG_MIGRATE_LOCK_ID = 7241865325823964;

const readdir = (...args) =>
  new Promise((resolve, reject) =>
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.readdir(...args, (err, files) => (err ? reject(err) : resolve(files)))
  );

const idColumn = "id";
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
              : f1 > f2
                ? 1
                : 0
        )
        .map(file => {
          const filePath = `${options.dir}/${file}`;
          const actions =
            path.extname(filePath) === ".sql"
              ? // eslint-disable-next-line security/detect-non-literal-fs-filename
                { up: pgm => pgm.sql(fs.readFileSync(filePath, "utf8")) }
              : // eslint-disable-next-line global-require,import/no-dynamic-require,security/detect-non-literal-require
                require(path.relative(__dirname, filePath));
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

const lock = db =>
  db
    .query(
      `select pg_try_advisory_lock(${PG_MIGRATE_LOCK_ID}) as lock_obtained`
    )
    .then(result => {
      if (!result.rows[0].lock_obtained) {
        throw new Error("Another migration is already running");
      }
    });

const getRunMigrations = (db, options) => {
  const schema = getMigrationTableSchema(options);
  const { migrationsTable } = options;
  const fullTableName = {
    schema,
    name: migrationsTable
  };
  return db
    .query(
      template`DO $$
               DECLARE
                 v_cnt INT;
               BEGIN
                 v_cnt := (SELECT count(1) FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = '${migrationsTable}');
                 IF v_cnt = 1 THEN
                   v_cnt := (SELECT count(1) FROM information_schema.table_constraints WHERE table_schema = '${schema}' AND table_name = '${migrationsTable}' AND constraint_type = 'PRIMARY KEY');
                   IF v_cnt = 0 THEN
                     ALTER TABLE "${fullTableName}" ADD PRIMARY KEY (${idColumn});
                   END IF;
                 ELSE
                   CREATE TABLE "${fullTableName}" ( ${idColumn} SERIAL PRIMARY KEY, ${nameColumn} varchar(255) NOT NULL, ${runOnColumn} timestamp NOT NULL);
                 END IF;
               END;
               $$;`
    )
    .then(() => (!options.noLock ? lock(db, options) : null))
    .then(() =>
      db.column(
        template`SELECT ${nameColumn} FROM "${fullTableName}" ORDER BY ${runOnColumn}, ${idColumn}`,
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
  options.singleTransaction ? db.query(operation) : Promise.resolve();

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
