# What is node-pg-migrate?

> [!IMPORTANT]
> The core maintainer of this project moved to [@Shinigami92](https://github.com/Shinigami92) (also core maintainer of FakerJS and core member of Vite).  
> The project is and remains under the MIT license.

Node.js database migration management built exclusively for postgres. (But can also be used for other DBs conforming to SQL standard - e.g. [CockroachDB](https://github.com/cockroachdb/cockroach).)  
Started by [Theo Ephraim](https://github.com/theoephraim/), then handed over to [Salsita Software](https://www.salsitasoft.com/) and now maintained by [@Shinigami92](https://github.com/Shinigami92).

## Explanation & Goals

### _Why only Postgres?_

By writing this migration tool specifically for postgres instead of accommodating many databases, we can actually provide a full featured tool that is much simpler to use and maintain. I was tired of using crippled database tools just in case one day we switch our database.

### _Async / Sync_

Everything is async in node, and that's great, but a migration tool should really just be a fancy wrapper that generates SQL. Most other migration tools force you to bring in control flow libraries or wrap everything in callbacks as soon as you want to do more than a single operation in a migration. Plus by building up a stack of operations, we can automatically infer down migrations (sometimes) to save even more time.

### _Naming / Raw Sql_

Many tools force you to use their constants to do things like specify data types. Again, this tool should be a fancy wrapper that generates SQL, so whenever possible, it should just pass through user values directly to the SQL. The hard part is remembering the syntax of the specific operation, not remembering how to type "timestamp"!

## License

This project is licensed under [MIT](https://github.com/salsita/node-pg-migrate/blob/main/LICENSE) license.
