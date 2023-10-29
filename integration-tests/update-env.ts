//TODO: UPDATE THIS

import _ from "lodash"
import fs from "fs"
import env from "./env.json"
import CHECKER_BOT_REPONSES from "../functions/src/definitions/common/parameters/checkerResponses.json"
import USER_BOT_RESPONSES from "../functions/src/definitions/common/parameters/userResponses.json"
import { language } from "googleapis/build/src/apis/language"

const factCheckerKeys = Object.keys(CHECKER_BOT_REPONSES).map((key) => {
  return `__CONSTANTS__.FACTCHECKER_BOT_RESPONSES.${key}`
})
const userKeys = Object.entries(USER_BOT_RESPONSES).flatMap(([key, value]) => {
  return Object.keys(value).map(
    (language) => `__CONSTANTS__.USER_BOT_RESPONSES.${key}.${language}`
  )
})

//combine the two lists
const allKeys = factCheckerKeys.concat(userKeys)

//find if each key in allKeys is inside env.values, if not, add it
allKeys.forEach((key) => {
  const found = env.values.find((value) => {
    return value.key === key
  })
  if (!found) {
    env.values.push({
      key,
      value: "",
      enabled: true,
    })
  }
})

//loop through each key in env.values, if it starts with "__CONSTANTS___" but is not in allKeys, remove it
const envWithRemovedValues = env.values.filter((value) => {
  if (value.key.startsWith("__CONSTANTS__.")) {
    const key = value.key
    const found = allKeys.find((allKey) => {
      return allKey === key
    })
    if (!found) {
      return false
    } else {
      return true
    }
  } else {
    return true
  }
})

const envWithReplacedValues = envWithRemovedValues.map((value) => {
  if (value.key.startsWith("__CONSTANTS__.")) {
    const stringParts = value.key.split(".")
    const key = stringParts.slice(2).join(".")
    if (stringParts[1] === "FACTCHECKER_BOT_RESPONSES") {
      value.value = _.get(CHECKER_BOT_REPONSES, key)
    } else if (stringParts[1] === "USER_BOT_RESPONSES") {
      value.value = _.get(USER_BOT_RESPONSES, key)
    }
    return value
  } else {
    return value
  }
})

env.values = envWithReplacedValues

fs.writeFileSync("env.json", JSON.stringify(env, null, 2))
