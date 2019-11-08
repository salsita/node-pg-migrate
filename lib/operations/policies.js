const makeClauses = ({ role, using, check }) => {
  const roles = Array.isArray(role) ? role.join(', ') : role;
  const clauses = [];
  if (roles) {
    clauses.push(`TO ${roles}`);
  }
  if (using) {
    clauses.push(`USING (${using})`);
  }
  if (check) {
    clauses.push(`WITH CHECK (${check})`);
  }
  return clauses;
};

function dropPolicy(mOptions) {
  const _drop = (tableName, policyName, { ifExists } = {}) => {
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);
    return `DROP POLICY${ifExistsStr} ${policyNameStr} ON ${tableNameStr};`;
  };
  return _drop;
}

function createPolicy(mOptions) {
  const _create = (tableName, policyName, options = {}) => {
    const createOptions = {
      ...options,
      role: options.role || 'PUBLIC'
    };
    const clauses = [
      `FOR ${options.command || 'ALL'}`,
      ...makeClauses(createOptions)
    ];
    // by default, don't add the 'PERMISSIVE' clause, for Postgres <10
    if (typeof options.restrictive === 'boolean')
      clauses.unshift(
        `AS ${options.restrictive ? 'RESTRICTIVE' : 'PERMISSIVE'}`
      );
    const clausesStr = clauses.join(' ');
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);
    return `CREATE POLICY ${policyNameStr} ON ${tableNameStr} ${clausesStr};`;
  };
  _create.reverse = dropPolicy(mOptions);
  return _create;
}

function alterPolicy(mOptions) {
  const _alter = (tableName, policyName, options = {}) => {
    const clausesStr = makeClauses(options).join(' ');
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);
    return `ALTER POLICY ${policyNameStr} ON ${tableNameStr} ${clausesStr};`;
  };
  return _alter;
}

function renamePolicy(mOptions) {
  const _rename = (tableName, policyName, newPolicyName) => {
    const policyNameStr = mOptions.literal(policyName);
    const newPolicyNameStr = mOptions.literal(newPolicyName);
    const tableNameStr = mOptions.literal(tableName);
    return `ALTER POLICY ${policyNameStr} ON ${tableNameStr} RENAME TO ${newPolicyNameStr};`;
  };
  _rename.reverse = (tableName, policyName, newPolicyName) =>
    _rename(tableName, newPolicyName, policyName);
  return _rename;
}

module.exports = {
  createPolicy,
  dropPolicy,
  alterPolicy,
  renamePolicy
};
