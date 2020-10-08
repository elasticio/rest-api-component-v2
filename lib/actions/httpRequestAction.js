const { processMethod } = require('../utils.js');

function processAction(msg, cfg) {
  return processMethod.call(this, msg, cfg);
}

exports.process = processAction;
