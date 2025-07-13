# TypeScript and Modern JavaScript Support

TypeScript and modern JavaScript are supported out of the box via [jiti](https://github.com/unjs/jiti).

### Usage

You can add a script to your `package.json`:

```jsonc
{
  "scripts": {
    // ..
    "migrate": "node-pg-migrate -j ts", // [!code ++]
  },
}
```

Now you can run migrations with:

::: code-group

```bash [npm]
npm run migrate
```

```bash [pnpm]
pnpm run migrate
```

```bash [yarn]
yarn migrate
```

```bash [bun]
bun run migrate
```

:::
