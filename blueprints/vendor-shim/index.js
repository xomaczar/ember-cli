var stringUtil = require('ember-cli-string-utils');

module.exports = {
  description: 'Generates an ES6 module shim for global libraries.',
  locals(options) {
    var entity = options.entity;
    var rawName = entity.name;
    var name = stringUtil.dasherize(rawName);

    return {
      name,
    };
  },
};
