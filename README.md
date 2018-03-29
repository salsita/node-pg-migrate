# node-pg-migrate

[![Dependency Status](https://img.shields.io/david/salsita/node-pg-migrate.svg)](https://david-dm.org/salsita/node-pg-migrate)
[![devDependency Status](https://img.shields.io/david/dev/salsita/node-pg-migrate.svg)](https://david-dm.org/salsita/node-pg-migrate?type=dev)
[![NPM version](https://img.shields.io/npm/v/node-pg-migrate.svg)](https://www.npmjs.com/package/node-pg-migrate)
![Downloads](https://img.shields.io/npm/dm/node-pg-migrate.svg?style=flat)
![Licence](https://img.shields.io/npm/l/node-pg-migrate.svg?style=flat)
[![Known Vulnerabilities](https://snyk.io/test/github/salsita/node-pg-migrate/badge.svg)](https://snyk.io/test/github/salsita/node-pg-migrate)

Node.js database migration management built exclusively for postgres. (But can also be used for other DBs conforming to SQL standard - e.g. [CockroachDB](https://github.com/cockroachdb/cockroach).)
Started by [Theo Ephraim](https://github.com/theoephraim/), now maintained by [Salsita Software](https://www.salsitasoft.com/).

### Looking for v2 docs?

see [v2 branch](https://github.com/salsita/node-pg-migrate/tree/v2).

## Installation

    $ npm install node-pg-migrate

Installing this module adds a runnable file into your `node_modules/.bin` directory. If installed globally (with the -g option), you can run `node-pg-migrate` and if not, you can run `./node_modules/.bin/node-pg-migrate`

## Usage

* [CLI](docs/cli.md)
* [Programmatic API](docs/api.md)
* [Defining Migrations](docs/migrations.md)
  * [Tables](docs/tables.md)
  * [Columns](docs/columns.md)
  * [Constraints](docs/constraints.md)
  * [Indexes](docs/indexes.md)
  * [Functions](docs/functions.md)
  * [Triggers](docs/triggers.md)
  * [Schemas](docs/schemas.md)
  * [Sequences](docs/sequences.md)
  * [Views](docs/views.md)
  * [Materialized Views](docs/mViews.md)
  * [Types](docs/types.md)
  * [Domains](docs/domains.md)
  * [Operators](docs/operators.md)
  * [Roles](docs/roles.md)
  * [Policies](docs/policies.md)
  * [Extensions](docs/extensions.md)
  * [Miscellaneous](docs/misc.md)
* [Transpiling migrations](docs/transpiling.md)

## Explanation & Goals

_Why only Postgres?_ - By writing this migration tool specifically for postgres instead of accommadating many databases, we can actually provide a full featured tool that is much simpler to use and maintain. I was tired of using crippled database tools just in case one day we switch our database.

_Async / Sync_ - Everything is async in node, and that's great, but a migration tool should really just be a fancy wrapper that generates SQL. Most other migration tools force you to bring in control flow libraries or wrap everything in callbacks as soon as you want to do more than a single operation in a migration. Plus by building up a stack of operations, we can automatically infer down migrations (sometimes) to save even more time.

_Naming / Raw Sql_ - Many tools force you to use their constants to do things like specify data types. Again, this tool should be a fancy wrapper that generates SQL, so whenever possible, it should just pass through user values directly to the SQL. The hard part is remembering the syntax of the specific operation, not remembering how to type "timestamp"!

## License

The MIT License (MIT)

Copyright (c) 2016 Jan Dolezel &lt;dolezel.jan@gmail.com&gt;

Copyright (c) 2014 Theo Ephraim

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
