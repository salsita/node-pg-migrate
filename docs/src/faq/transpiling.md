# Transpiling

## Transpiling Babel

You can use babel for transpiling migration files. You have e.g. these options:

### Use global configuration

Update `scripts` section in your `package.json` to contain babel-node command:

```jsonc
{
  "scripts": {
    // ..
    "migrate": "babel-node node_modules/node-pg-migrate/bin/node-pg-migrate.js", // [!code ++]
  },
}
```

### Use custom configuration

It requires a little setup to use:

1. Update `scripts` section in your `package.json` to contain `'migrate': 'node migrate.js'`
2. Create `migrate.js` file with contents:

   ```js
   require('babel-core/register')({
     /* ... your babel config ... */
   });
   require('./node_modules/node-pg-migrate/bin/node-pg-migrate.js');
   ```

## Transpiling Typescript

### Use flag

Typescript is supported out of the box. You need to have installed `ts-node` package and need to pass `tsconfig`
arg ([see](/cli#configuration))

### Use global configuration

Another option is to use [ts-node](https://www.npmjs.com/package/ts-node) CLI directly and it needs to be available
globally or as a dependency.

```jsonc
{
  "scripts": {
    // ..
    "migrate": "ts-node node_modules/.bin/node-pg-migrate.js -j ts", // [!code ++]
  },
}
```

### Use custom configuration

If you need some more advanced TS config, you need to register transpiler yourself like in using babel configuration.

```js
const config = {
  /* ... your ts config ... */
};
require('ts-node').register(config);
// e.g. require("tsconfig-paths").register(config.compilerOptions);
require('./node_modules/node-pg-migrate/bin/node-pg-migrate.js');
```
