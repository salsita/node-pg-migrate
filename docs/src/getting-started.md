# Getting Started 

## Preconditions

- Node.js 18 or higher
- PostgreSQL 12.8 or higher (lower versions may work but are not supported officially)

If you don't already have the [`pg`](https://node-postgres.com/) library installed, you will need to add pg as either a direct or dev dependency

::: code-group

```sh [npm]
$ npm add pg
```

```sh [pnpm]
$ pnpm add pg
```

```sh [yarn]
$ yarn add pg
```

```sh [bun]
$ bun add pg
```

:::

## Installation

::: code-group

```sh [npm]
$ npm add -D node-pg-migrate
```

```sh [pnpm]
$ pnpm add -D node-pg-migrate
```

```sh [yarn]
$ yarn add -D node-pg-migrate
```

```sh [bun]
$ bun add -D node-pg-migrate
```

:::

Installing this module adds a runnable file into your `node_modules/.bin` directory. If installed globally (with the -g option), you can run `node-pg-migrate` and if not, you can run `./node_modules/.bin/node-pg-migrate.js`

## Quick Example

> [!IMPORTANT]
> This example assumes you are using `npm` as your package manager. If you are using another package manager, replace `npm` with the appropriate command.

Add `node-pg-migrate` to `scripts` section of your `package.json` so you are able to quickly run commands.

```json
{
  "scripts": {
    // ..
    "migrate": "node-pg-migrate" // [!code ++]
  },
}
```

Run `npm run migrate create my-first-migration`. It will create file `xxx_my-first-migration.js` in `migrations` folder.  
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
  });
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
  });
  pgm.createIndex('posts', 'userId');
};
```

Save migration file.

Now you should put your DB connection string to `DATABASE_URL` environment variable and run `npm run migrate up`.
(e.g. `DATABASE_URL=postgres://test:test@localhost:5432/test npm run migrate up`)

You should now have two tables in your DB :tada:

If you want to change your schema later, you can e.g. add lead paragraph to posts:

Run `npm run migrate create posts_lead`, edit `xxx_posts_lead.js`:

```js
exports.up = (pgm) => {
  pgm.addColumns('posts', {
    lead: { type: 'text', notNull: true },
  });
};
```

Run `npm run migrate up` and there will be a new column in `posts` table :tada:

## Want to know more?

- [CLI commands](/cli)
- [Programmatic API](/api)
- [Migration files](/migrations/)
