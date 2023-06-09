const _ = require('lodash');
const fs = require('fs');
const env = require('./env.json');
const constants = require('../functions/src/definitions/common/constants');

const envWithReplacedValues = env.values.map((value) => {
  if (value.key.startsWith('__CONSTANTS__.')) {
    const key = value.key.replace('__CONSTANTS__.', '');
    const newValue = _.get(constants, key);
    value.value = newValue;
    return value;
  } else {
    return value;
  }
});

env.values = envWithReplacedValues;

fs.writeFileSync('env.json', JSON.stringify(env, null, 2));
