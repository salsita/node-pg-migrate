const policy = require('./057_policy_create.cjs');

exports.up = policy.down;

exports.down = policy.up;
