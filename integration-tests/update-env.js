const _ = require("lodash");
const fs = require("fs");
const env = require("./env.json");
const constants = require("../functions/src/definitions/common/constants");

const factCheckerKeys = Object.keys(constants.FACTCHECKER_BOT_RESPONSES).map(
  (key) => {
    return `__CONSTANTS__.FACTCHECKER_BOT_RESPONSES.${key}`;
  }
);
const userKeys = Object.keys(constants.USER_BOT_RESPONSES).map((key) => {
  return `__CONSTANTS__.USER_BOT_RESPONSES.${key}`;
});

//combine the two lists
const allKeys = factCheckerKeys.concat(userKeys);

//find if each key in allKeys is inside env.values, if not, add it
allKeys.forEach((key) => {
  const found = env.values.find((value) => {
    return value.key === key;
  });
  if (!found) {
    env.values.push({
      key,
      value: "",
      enabled: true,
    });
  }
});

//loop through each key in env.values, if it starts with "__CONSTANTS___" but is not in allKeys, remove it
const envWithRemovedValues = env.values.filter((value) => {
  if (value.key.startsWith("__CONSTANTS__.")) {
    const key = value.key;
    const found = allKeys.find((allKey) => {
      return allKey === key;
    });
    if (!found) {
      return false;
    } else {
      return true;
    }
  } else {
    return true;
  }
});

const envWithReplacedValues = envWithRemovedValues.map((value) => {
  if (value.key.startsWith("__CONSTANTS__.")) {
    const key = value.key.replace("__CONSTANTS__.", "");
    const newValue = _.get(constants, key);
    value.value = newValue;
    return value;
  } else {
    return value;
  }
});

env.values = envWithReplacedValues;

fs.writeFileSync("env.json", JSON.stringify(env, null, 2));
