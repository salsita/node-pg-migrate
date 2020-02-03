/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": true}] */
const chai = require('chai')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')

const config = require('./tsconfig-test.json')

config.compilerOptions.module = 'commonjs'
config.transpileOnly = true

// eslint-disable-next-line import/no-extraneous-dependencies
require('ts-node').register(config)

chai.use(sinonChai)
chai.use(chaiAsPromised)
