import path from "path";
import fs from "fs";
import Db from "./db";
import Migration from "./migration";
import { getMigrationTableSchema, template, promisify } from "./utils";

export { PgLiteral } from "./utils";

// Random but well-known identifier shared by all instances of node-pg-migrate
const PG_MIGRATE_LOCK_ID = 7241865325823964;

const readdir = promisify(fs.readdir);
const lstat = promisify(fs.lstat);

const idColumn = "id";
const nameColumn = "name";
const runOnColumn = "run_on";

const loadMigrationFiles = async (db, options, log) => {
  try {
    const files = await Promise.all(
      (await readdir(`${options.dir}/`)).map(async file => {
        const stats = await lstat(`${options.dir}/${file}`);
        return stats.isFile() ? file : null;
      })
    );
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
  } catch (err) {
    throw new Error(`Can't get migration files: ${err.stack}`);
  }
};

const lock = async db => {
  const {
    rows: [lockObtained]
  } = await db.query(
    `select pg_try_advisory_lock(${PG_MIGRATE_LOCK_ID}) as "lockObtained"`
  );
  if (!lockObtained) {
    throw new Error("Another migration is already running");
  }
};

const ensureMigrationsTable = async (db, options) => {
  try {
    const schema = getMigrationTableSchema(options);
    const { migrationsTable } = options;
    const fullTableName = {
      schema,
      name: migrationsTable
    };

    const migrationTables = await db.select(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = '${migrationsTable}'`
    );

    if (migrationTables && migrationTables.length === 1) {
      const primaryKeyConstraints = await db.select(
        `SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = '${schema}' AND table_name = '${migrationsTable}' AND constraint_type = 'PRIMARY KEY'`
      );
      if (!primaryKeyConstraints || primaryKeyConstraints.length !== 1) {
        await db.query(
          template`ALTER TABLE "${fullTableName}" ADD PRIMARY KEY (${idColumn})`
        );
      }
    } else {
      await db.query(
        template`CREATE TABLE "${fullTableName}" ( ${idColumn} SERIAL PRIMARY KEY, ${nameColumn} varchar(255) NOT NULL, ${runOnColumn} timestamp NOT NULL)`
      );
    }
  } catch (err) {
    throw new Error(`Unable to ensure migrations table: ${err.stack}`);
  }
};

const getRunMigrations = async (db, options) => {
  const schema = getMigrationTableSchema(options);
  const { migrationsTable } = options;
  const fullTableName = {
    schema,
    name: migrationsTable
  };
  return db.column(
    template`SELECT ${nameColumn} FROM "${fullTableName}" ORDER BY ${runOnColumn}, ${idColumn}`,
    nameColumn
  );
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

const checkOrder = (runNames, migrations) => {
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
};

const runMigrations = (toRun, direction) =>
  toRun.reduce(
    (promise, migration) =>
      promise.then(
        () => (direction === "up" ? migration.applyUp() : migration.applyDown())
      ),
    Promise.resolve()
  );

export default async options => {
  const log = options.log || console.log;
  const db = Db(options.databaseUrl, log);
  try {
    if (options.schema) {
      if (options.createSchema) {
        await db.query(`CREATE SCHEMA IF NOT EXISTS "${options.schema}"`);
      }
      await db.query(`SET SCHEMA '${options.schema}'`);
    }
    if (options.migrationsSchema && options.createMigrationsSchema) {
      await db.query(
        `CREATE SCHEMA IF NOT EXISTS "${options.migrationsSchema}"`
      );
    }

    await ensureMigrationsTable(db, options);

    if (!options.noLock) {
      await lock(db, options);
    }

    const [migrations, runNames] = await Promise.all([
      loadMigrationFiles(db, options, log),
      getRunMigrations(db, options)
    ]);

    if (options.checkOrder) {
      checkOrder(runNames, migrations);
    }

    const toRun = getMigrationsToRun(options, runNames, migrations);

    if (!toRun.length) {
      log("No migrations to run!");
      return;
    }

    // TODO: add some fancy colors to logging
    log("> Migrating files:");
    toRun.forEach(m => {
      log(`> - ${m.name}`);
    });

    if (options.singleTransaction) {
      await db.query("BEGIN");
      try {
        await runMigrations(toRun, options.direction);
        await db.query("COMMIT");
      } catch (err) {
        log("> Rolling back attempted migration ...");
        await db.query("ROLLBACK");
        throw err;
      }
    } else {
      await runMigrations(toRun, options.direction);
    }
  } finally {
    db.close();
  }
};
