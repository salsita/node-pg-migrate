/*
 A new Migration is instantiated for each migration file.

 It is responsible for storing the name of the file and knowing how to execute
 the up and down migrations defined in the file.

 */

import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';
import util from 'util';

import MigrationBuilder from './migration-builder';

class Migration {

  // class method that creates a new migration file by cloning the migration template
  static create(name, directory) {
    // ensure the migrations directory exists
    mkdirp.sync(directory);

    // file name looks like migrations/1391877300255_migration-title.js
    const new_file = util.format('%s/%d_%s.js', directory, +new Date(), name);

    // copy the default migration template to the new file location
    fs.createReadStream(path.resolve(__dirname, './migration-template.js'))
      .pipe(fs.createWriteStream(new_file));

    return new Migration(new_file);
  }

  constructor(db, migrationPath, actions = {}, options = {}) {
    this.db = db;
    this.path = migrationPath;
    this.name = migrationPath.split('/').pop().replace(/\.js$/, '');
    this.up = actions.up;
    this.down = actions.down;
    this.options = options;
  }

  _apply(action, pgm) {
    return new Promise((resolve) => {
      if (action.length === 2) {
        action(pgm, resolve);
      } else {
        const result = action(pgm);
        // result conforms to Promises/A+ spec
        if (typeof result === 'object' && typeof result.then === 'function') {
          result.then(resolve);
        } else {
          resolve();
        }
      }
    }).then(() => {
      const sql_steps = pgm.getSqlSteps();

      switch (action) {
        case this.up:
          console.log(`### MIGRATION ${this.name} (UP) ###`);
          sql_steps.push(`INSERT INTO "${this.options.migrations_schema}"."${this.options.migrations_table}" (name, run_on) VALUES ('${this.name}', NOW());`);
          break;
        case this.down:
          console.log(`### MIGRATION ${this.name} (DOWN) ###`);
          sql_steps.push(`DELETE FROM "${this.options.migrations_schema}"."${this.options.migrations_table}" WHERE name='${this.name}';`);
          break;
        default:
          throw new Error('Unknown direction');
      }

      if (pgm.isUsingTransaction()) {
        // wrap in a transaction, combine into one sql statement
        sql_steps.unshift('BEGIN;');
        sql_steps.push('COMMIT;');
      } else {
        console.log('#> WARNING: This migration is not wrapped in a transaction! <');
      }

      console.log(`${sql_steps.join('\n')}\n\n`);

      return sql_steps.reduce(
        (promise, sql) => promise.then(() => this.options.dryRun || this.db.query(sql)),
        Promise.resolve()
      );
    });
  }

  applyUp() {
    const pgm = new MigrationBuilder();

    return this._apply(this.up, pgm);
  }

  applyDown() {
    const pgm = new MigrationBuilder();

    if (this.down === false) {
      return Promise.reject(`User has disabled down migration on file: ${this.name}`);
    } else if (this.down === undefined) {
      // automatically infer the down migration by running the up migration in reverse mode...
      pgm.enableReverseMode();
      this.down = this.up;
    }

    return this._apply(this.down, pgm);
  }
}

export default Migration;
