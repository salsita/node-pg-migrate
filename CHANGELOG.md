# Change Log

## [2.0.0] (2017-04-20)

Rewritten using es6 (transpiled via [babel](https://babeljs.io/)) and Promises.

### Breaking Changes

- supports only node >= 4
- `check-order` flag now defaults to `true` (to switch it off supply `--no-check-order` on command line)
- [dotenv](https://www.npmjs.com/package/dotenv) package is `optionalDependency`

### Added

- [config](https://www.npmjs.com/package/config) package as `optionalDependency`
- Migration can return `Promise`
