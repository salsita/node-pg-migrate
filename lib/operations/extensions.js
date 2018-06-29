const _ = require("lodash");
const { template } = require("../utils");

function createExtension(extensions, { ifNotExists, schema } = {}) {
  if (!_.isArray(extensions)) extensions = [extensions]; // eslint-disable-line no-param-reassign
  return _.map(
    extensions,
    extension =>
      template`CREATE EXTENSION${
        ifNotExists ? " IF NOT EXISTS" : ""
      } "${extension}"${schema ? ` SCHEMA "${schema}"` : ""};`
  );
}

function dropExtension(extensions, { ifExists, cascade } = {}) {
  if (!_.isArray(extensions)) extensions = [extensions]; // eslint-disable-line no-param-reassign
  return _.map(
    extensions,
    extension =>
      template`DROP EXTENSION${ifExists ? " IF EXISTS" : ""} "${extension}"${
        cascade ? " CASCADE" : ""
      };`
  );
}

// setup reverse functions
createExtension.reverse = dropExtension;

module.exports = {
  createExtension,
  dropExtension
};
