const chai = require('chai');
const sinonChai = require('sinon-chai');
const chaiAsPromised = require('chai-as-promised');

const config = require('./tsconfig-test.json');

config.compilerOptions.module = 'commonjs';
config.transpileOnly = true;

require('ts-node').register(config);

chai.use(sinonChai);
chai.use(chaiAsPromised);
