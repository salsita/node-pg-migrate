/*
 A new Migration is instantiated for each migration file.

 It is responsible for storing the name of the file and knowing how to execute
 the up and down migrations defined in the file.

 */

const fs = require("fs");
const mkdirp = require("mkdirp");
const path = require("path");

const MigrationBuilder = require("./migration-builder");
const { getMigrationTableSchema } = require("./utils");

const SEPARATOR = "_";

module.exports = class Migration {
  // class method that creates a new migration file by cloning the migration template
  static create(name, directory, language) {
    // ensure the migrations directory exists
    mkdirp.sync(directory);

    // file name looks like migrations/1391877300255_migration-title.js
    const newFile = `${directory}/${Date.now()}${SEPARATOR}${name}.${language}`;

    // copy the default migration template to the new file location
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.createReadStream(
      path.resolve(__dirname, `./migration-template.${language}`)
      // eslint-disable-next-line security/detect-non-literal-fs-filename
    ).pipe(fs.createWriteStream(newFile));

    return new Migration(newFile, directory);
  }

  constructor(
    db,
    migrationPath,
    { up, down } = {},
    options = {},
    typeShorthands,
    log = console.log
  ) {
    this.db = db;
    this.path = migrationPath;
    this.name = path.basename(migrationPath, path.extname(migrationPath));
    this.timestamp = Number(this.name.split(SEPARATOR)[0]) || 0;
    this.up = up;
    this.down = down;
    this.options = options;
    this.typeShorthands = typeShorthands;
    this.log = log;
  }

  _getMarkAsRun(action) {
    const schema = getMigrationTableSchema(this.options);
    const { migrationsTable } = this.options;
    const { name } = this;
    switch (action) {
      case this.down:
        this.log(`### MIGRATION ${this.name} (DOWN) ###`);
        return `DELETE FROM "${schema}"."${migrationsTable}" WHERE name='${name}';`;
      case this.up:
        this.log(`### MIGRATION ${this.name} (UP) ###`);
        return `INSERT INTO "${schema}"."${migrationsTable}" (name, run_on) VALUES ('${name}', NOW());`;
      default:
        throw new Error("Unknown direction");
    }
  }

  async _apply(action, pgm) {
    if (action.length === 2) {
      await new Promise(resolve => action(pgm, resolve));
    } else {
      await action(pgm);
    }

    const sqlSteps = pgm.getSqlSteps();

    sqlSteps.push(this._getMarkAsRun(action));

    if (!this.options.singleTransaction && pgm.isUsingTransaction()) {
      // if not in singleTransaction mode we need to create our own transaction
      sqlSteps.unshift("BEGIN;");
      sqlSteps.push("COMMIT;");
    } else if (this.options.singleTransaction && !pgm.isUsingTransaction()) {
      // in singleTransaction mode we are already wrapped in a global transaction
      this.log("#> WARNING: Need to break single transaction! <");
      sqlSteps.unshift("COMMIT;");
      sqlSteps.push("BEGIN;");
    } else if (!this.options.singleTransaction || !pgm.isUsingTransaction()) {
      this.log("#> WARNING: This migration is not wrapped in a transaction! <");
    }

    this.log(`${sqlSteps.join("\n")}\n\n`);

    return sqlSteps.reduce(
      (promise, sql) =>
        promise.then(() => this.options.dryRun || this.db.query(sql)),
      Promise.resolve()
    );
  }

  _getAction(direction) {
    return this[direction];
  }

  apply(direction) {
    const pgm = new MigrationBuilder(this.typeShorthands, this.db);
    const action = this._getAction(direction);

    if (action === this.down) {
      if (this.down === false) {
        return Promise.reject(
          new Error(`User has disabled down migration on file: ${this.name}`)
        );
      }

      if (this.down === undefined) {
        // automatically infer the down migration by running the up migration in reverse mode...
        pgm.enableReverseMode();
        this.down = this.up;
      }
    }

    return this._apply(action, pgm);
  }

  markAsRun(direction) {
    return this.db.query(this._getMarkAsRun(this._getAction(direction)));
  }
};
