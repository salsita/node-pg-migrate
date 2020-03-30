# node-pg-migrate

[![Dependency Status](https://img.shields.io/david/salsita/node-pg-migrate.svg)](https://david-dm.org/salsita/node-pg-migrate)
[![devDependency Status](https://img.shields.io/david/dev/salsita/node-pg-migrate.svg)](https://david-dm.org/salsita/node-pg-migrate?type=dev)
[![NPM version](https://img.shields.io/npm/v/node-pg-migrate.svg)](https://www.npmjs.com/package/node-pg-migrate)
![Downloads](https://img.shields.io/npm/dm/node-pg-migrate.svg?style=flat)
![Licence](https://img.shields.io/npm/l/node-pg-migrate.svg?style=flat)
[![Known Vulnerabilities](https://snyk.io/test/github/salsita/node-pg-migrate/badge.svg)](https://snyk.io/test/github/salsita/node-pg-migrate)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com/)
[![CircleCI](https://img.shields.io/circleci/project/github/salsita/node-pg-migrate.svg)](https://circleci.com/gh/salsita/workflows/node-pg-migrate)

Node.js database migration management built exclusively for postgres. (But can also be used for other DBs conforming to SQL standard - e.g. [CockroachDB](https://github.com/cockroachdb/cockroach).)
Started by [Theo Ephraim](https://github.com/theoephraim/), now maintained by [Salsita Software](https://www.salsitasoft.com/).

### Looking for v3 docs?

see [v3 branch](https://github.com/salsita/node-pg-migrate/tree/v3).

## Installation

    $ npm install node-pg-migrate pg

Installing this module adds a runnable file into your `node_modules/.bin` directory. If installed globally (with the -g option), you can run `node-pg-migrate` and if not, you can run `./node_modules/.bin/node-pg-migrate`

It will also install [`pg`](https://node-postgres.com/) library as it is peer dependency used for migrations.

## Quick Example

Add `"migrate": "node-pg-migrate"` to `scripts` section of `package.json` so you are able to quickly run commands.

Run `npm run migrate create my first migration`. It will create file `xxx_my-first-migration.js` in `migrations` folder.
Open it and change contents to:

```js
exports.up = (pgm) => {
  pgm.createTable('users', {
    id: 'id',
    name: { type: 'varchar(1000)', notNull: true },
    createdAt: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  })
  pgm.createTable('posts', {
    id: 'id',
    userId: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'cascade',
    },
    body: { type: 'text', notNull: true },
    createdAt: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  })
  pgm.createIndex('posts', 'userId')
}
```

Save migration file.

Now you should put your DB connection string to `DATABASE_URL` environment variable and run `npm run migrate up`.
(e.g. `DATABASE_URL=postgres://test:test@localhost:5432/test npm run migrate up`)

You should now have two tables in your DB :tada:

If you will want to change your schema later, you can e.g. add lead paragraph to posts:

Run `npm run migrate create posts lead`, edit `xxx_posts_lead.js`:

```js
exports.up = (pgm) => {
  pgm.addColumns('posts', {
    lead: { type: 'text', notNull: true },
  })
}
```

Run `npm run migrate up` and there will be new column in `posts` table :tada: :tada:

Want to know more? Read docs:

## Docs

Full docs are available at https://salsita.github.io/node-pg-migrate

## Explanation & Goals

_Why only Postgres?_ - By writing this migration tool specifically for postgres instead of accommodating many databases, we can actually provide a full featured tool that is much simpler to use and maintain. I was tired of using crippled database tools just in case one day we switch our database.

_Async / Sync_ - Everything is async in node, and that's great, but a migration tool should really just be a fancy wrapper that generates SQL. Most other migration tools force you to bring in control flow libraries or wrap everything in callbacks as soon as you want to do more than a single operation in a migration. Plus by building up a stack of operations, we can automatically infer down migrations (sometimes) to save even more time.

_Naming / Raw Sql_ - Many tools force you to use their constants to do things like specify data types. Again, this tool should be a fancy wrapper that generates SQL, so whenever possible, it should just pass through user values directly to the SQL. The hard part is remembering the syntax of the specific operation, not remembering how to type "timestamp"!

## License

The MIT License (MIT)

Copyright (c) 2016-2020 Salsita Software &lt;jando@salsitasoft.com&gt;

Copyright (c) 2014-2016 Theo Ephraim

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
