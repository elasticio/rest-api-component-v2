const { processMethod } = require('../utils.js');

function processTrigger(msg, cfg) {
  // eslint-disable-next-line no-param-reassign
  msg.body = {};
  return processMethod.call(this, msg, cfg);
}

exports.process = processTrigger;
