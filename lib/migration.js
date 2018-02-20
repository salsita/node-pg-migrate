/*
 A new Migration is instantiated for each migration file.

 It is responsible for storing the name of the file and knowing how to execute
 the up and down migrations defined in the file.

 */

import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';

import MigrationBuilder from './migration-builder';
import { getMigrationTableSchema } from './utils';

const SEPARATOR = '_';

class Migration {
  // class method that creates a new migration file by cloning the migration template
  static create(name, directory, language) {
    // ensure the migrations directory exists
    mkdirp.sync(directory);

    // file name looks like migrations/1391877300255_migration-title.js
    const newFile = `${directory}/${Date.now()}${SEPARATOR}${name}.${language}`;

    // copy the default migration template to the new file location
    fs.createReadStream(path.resolve(__dirname, `./migration-template.${language}`))
      .pipe(fs.createWriteStream(newFile));

    return new Migration(newFile, directory);
  }

  constructor(db, migrationPath, { up, down } = {}, options = {}, log = console.log) {
    this.db = db;
    this.path = migrationPath;
    this.name = path.basename(migrationPath, path.extname(migrationPath));
    this.timestamp = Number(this.name.split(SEPARATOR)[0]) || 0;
    this.up = up;
    this.down = down;
    this.options = options;
    this.log = log;
  }

  _apply(action, pgm) {
    return new Promise((resolve, reject) => {
      if (action.length === 2) {
        action(pgm, resolve);
      } else {
        const result = action(pgm);
        // result conforms to Promises/A+ spec
        if (typeof result === 'object' && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          resolve();
        }
      }
    }).then(() => {
      const sqlSteps = pgm.getSqlSteps();

      const schema = getMigrationTableSchema(this.options);
      switch (action) {
        case this.down:
          this.log(`### MIGRATION ${this.name} (DOWN) ###`);
          sqlSteps.push(`DELETE FROM "${schema}"."${this.options.migrationsTable}" WHERE name='${this.name}';`);
          break;
        case this.up:
          this.log(`### MIGRATION ${this.name} (UP) ###`);
          sqlSteps.push(`INSERT INTO "${schema}"."${this.options.migrationsTable}" (name, run_on) VALUES ('${this.name}', NOW());`);
          break;
        default:
          throw new Error('Unknown direction');
      }

      if (pgm.isUsingTransaction()) {
        // wrap in a transaction, combine into one sql statement
        sqlSteps.unshift('BEGIN;');
        sqlSteps.push('COMMIT;');
      } else {
        this.log('#> WARNING: This migration is not wrapped in a transaction! <');
      }

      this.log(`${sqlSteps.join('\n')}\n\n`);

      return sqlSteps.reduce(
        (promise, sql) => promise.then(() => this.options.dryRun || this.db.query(sql)),
        Promise.resolve()
      );
    });
  }

  applyUp() {
    const pgm = new MigrationBuilder(this.options);

    return this._apply(this.up, pgm);
  }

  applyDown() {
    const pgm = new MigrationBuilder(this.options);

    if (this.down === false) {
      return Promise.reject(new Error(`User has disabled down migration on file: ${this.name}`));
    } else if (this.down === undefined) {
      // automatically infer the down migration by running the up migration in reverse mode...
      pgm.enableReverseMode();
      this.down = this.up;
    }

    return this._apply(this.down, pgm);
  }
}

export default Migration;
