# Change Log

## [2.2.1] (2017-05-26)

### Fixed

- Syntax error in node 4

## [2.2.0] (2017-05-25)

### Added

- Better error logging #86
- Locking migrations #88
- Updated docs #89

## [2.1.1] (2017-05-18)

### Fixed

- Down migration when down method is inferred #84

## [2.1.0] (2017-05-10)

### Added

- Enable string functions and arrays as default column values #82

## [2.0.0] (2017-04-28)

Rewritten using es6 (transpiled via [babel](https://babeljs.io/)) and Promises.

### Breaking Changes

- supports only node >= 4
- `check-order` flag now defaults to `true` (to switch it off supply `--no-check-order` on command line)
- [dotenv](https://www.npmjs.com/package/dotenv) package is `optionalDependency`
- `s` option is now alias for `schema` which sets schema for migrations SQL, if you only need to change schema of migrations table use `--migrations-schema`

### Added

- [config](https://www.npmjs.com/package/config) package as `optionalDependency`
- Migration can return `Promise`
