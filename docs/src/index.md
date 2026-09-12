---
# https://vitepress.dev/reference/default-theme-home-page
layout: home
title: node-pg-migrate
titleTemplate: Database migrations, made for PostgreSQL

hero:
  name: 'node-pg-migrate'
  text: 'Database migrations, made for PostgreSQL'
  tagline: 'Write migrations in JavaScript, TypeScript or SQL, preview the exact SQL, and roll back without writing every down migration by hand.'
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: Why node-pg-migrate?
      link: /introduction
    - theme: alt
      text: GitHub
      link: https://github.com/salsita/node-pg-migrate

features:
  - title: Down migrations, inferred
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 15 4 10l5-5"/><path d="M4 10h11a5 5 0 0 1 0 10h-3"/></svg>'
    details: 'Leave out <code>down</code> and reversible operations undo themselves: <code>createTable</code> becomes <code>DROP TABLE</code>.'
    link: /migrations/#automatic-down-migrations
    linkText: Automatic down migrations
  - title: Preview every change
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>'
    details: '<code>up --dry-run</code> prints the SQL a real run would execute, inside a read-only transaction that cannot change your data.'
    link: /cli#dry-runs
    linkText: Dry runs
  - title: Safe on every deploy
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5v-3a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2"/></svg>'
    details: 'Pending migrations run in a single transaction under an advisory lock, and an order check refuses migrations that arrive out of sequence.'
    link: /cli#configuration
    linkText: Run options
  - title: JavaScript, TypeScript or SQL
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5Z"/><path d="M13.5 3v5.5H19"/><path d="m10 13-2 2 2 2"/><path d="m14 13 2 2-2 2"/></svg>'
    details: 'Scaffold migrations as <code>.js</code>, <code>.ts</code> or plain <code>.sql</code> files with <code>create</code>, and write them against a fully typed <code>pgm</code> API.'
    link: /faq/typescript
    linkText: TypeScript setup
  - title: All of Postgres
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5.5" rx="7.5" ry="2.5"/><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13"/><path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5"/></svg>'
    details: 'Tables and indexes, but also functions, triggers, policies, roles, domains and casts, each with its own operations.'
    link: /migrations/
    linkText: Browse operations
  - title: CLI or your own code
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="m7 9.5 3 2.5-3 2.5"/><path d="M12.5 15H17"/></svg>'
    details: 'Run <code>up</code>, <code>down</code> and <code>redo</code> from the terminal, or import <code>runner()</code> and migrate from a script, a test suite or your server.'
    link: /api
    linkText: Programmatic API
---

<div class="home-section">

## Code in, SQL out

Write migrations in TypeScript, JavaScript or plain SQL. In TypeScript and JavaScript every `pgm` call compiles to SQL: the second panel is exactly what `node-pg-migrate up --pretty` runs, plus the `down` it infers because the migration leaves one out. Hover the TypeScript code to see its types.

<div class="home-showcase">

::: code-group

```ts twoslash [create-users.ts]
import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('users', {
    id: 'id',
    email: { type: 'text', notNull: true, unique: true },
    createdAt: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  pgm.createIndex('users', 'createdAt');
}
```

```js [create-users.js]
export const up = (pgm) => {
  pgm.createTable('users', {
    id: 'id',
    email: { type: 'text', notNull: true, unique: true },
    createdAt: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  pgm.createIndex('users', 'createdAt');
};
```

```sql [create-users.sql]
-- Up Migration
CREATE TABLE "users" (
  "id" serial PRIMARY KEY,
  "email" text UNIQUE NOT NULL,
  "createdAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "users_createdAt_index" ON "users" ("createdAt");

-- Down Migration
DROP INDEX "users_createdAt_index";
DROP TABLE "users";
```

:::

::: code-group

```sql [up]
CREATE TABLE "users" (
  "id" serial PRIMARY KEY,
  "email" text UNIQUE NOT NULL,
  "createdAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "users_createdAt_index" ON "users" ("createdAt");
```

```sql [down (inferred)]
DROP INDEX "users_createdAt_index";
DROP TABLE "users";
```

:::

</div>

</div>

<div class="home-section">

## Built for Postgres, all of it

node-pg-migrate only targets PostgreSQL, so it can cover what Postgres actually has. Each of these has its own operations in the `pgm` API:

<div class="home-coverage">

- [Tables](/migrations/tables)
- [Columns](/migrations/columns)
- [Constraints](/migrations/constraints)
- [Indexes](/migrations/indexes)
- [Functions](/migrations/functions)
- [Triggers](/migrations/triggers)
- [Schemas](/migrations/schemas)
- [Sequences](/migrations/sequences)
- [Views](/migrations/views)
- [Materialized views](/migrations/mViews)
- [Types](/migrations/types)
- [Domains](/migrations/domains)
- [Operators](/migrations/operators)
- [Roles](/migrations/roles)
- [Policies](/migrations/policies)
- [Extensions](/migrations/extensions)
- [Grants](/migrations/grants)
- [Casts](/migrations/casts)

</div>

</div>
