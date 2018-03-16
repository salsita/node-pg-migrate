import { template } from '../utils';

const makeClauses = ({ role, using, check }) => {
  const roles = (Array.isArray(role) ? role : [role]).join(', ');
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

export const create = (tableName, policyName, options = {}) => {
  const createOptions = {
    ...options,
    role: options.role || 'PUBLIC',
  };
  const clauses = [
    `FOR ${options.command || 'ALL'}`,
    ...makeClauses(createOptions),
  ];
  return template`CREATE POLICY "${policyName}" ON "${tableName}" ${clauses.join(' ')};`;
};

export const alter = (tableName, policyName, options = {}) => {
  const clauses = makeClauses(options);
  return template`ALTER POLICY "${policyName}" ON "${tableName}" ${clauses.join(' ')};`;
};

export const drop = (tableName, policyName, { ifExists } = {}) =>
  template`DROP POLICY${ifExists ? ' IF EXISTS' : ''} "${policyName}" ON "${tableName}";`;

export const rename = (tableName, policyName, newPolicyName) =>
  template`ALTER POLICY  "${policyName}" ON "${tableName}" RENAME TO "${newPolicyName}";`;

export const undoRename = (tableName, policyName, newPolicyName) =>
  rename(tableName, newPolicyName, policyName);

// setup reverse functions
create.reverse = drop;
rename.reverse = undoRename;
