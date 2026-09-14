# Docs tests

Browser smoke tests for the built docs site (`docs/.vitepress/dist`), run with
[Playwright](https://playwright.dev/).

`pnpm run docs:build` only proves the site renders on the server. Some of the
docs' behaviour exists only in the browser, e.g. the Twoslash hover popups and
the FloatingVue patch their client applies, so a dependency bump can break the
published site while the build stays green. These tests open every page from
the generated sitemap in headless Chromium and fail on any console error,
uncaught exception, failed request or missing hydration, and check that a
Twoslash popup shows real types.

```bash
pnpm exec playwright install --only-shell chromium # once
pnpm run test:docs                                  # builds the docs first
```

Failed runs keep a Playwright trace under `test-results/`; open one with
`pnpm exec playwright show-trace <trace.zip>`.
