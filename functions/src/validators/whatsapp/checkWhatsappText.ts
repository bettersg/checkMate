import { WhatsappMessageObject } from "../../types"

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // $& means the whole matched string
}

function buildRegexFromTemplate(
  template: string,
  forStripping: boolean = false
) {
  // Escape special regex characters in the template except for placeholders
  const escapedTemplate = escapeRegExp(template)

  // Replace the placeholder {{code}} with the regex pattern for alphanumeric characters
  const pattern = escapedTemplate.replace(
    /\\\{\\\{code\\\}\\\}/g,
    "[a-zA-Z0-9]+"
  )

  // For stripping, we don't want anchors and need global flag
  if (forStripping) {
    return new RegExp(pattern, "g")
  }

  // For checking, we want strict matching with anchors
  return new RegExp("^" + pattern + "$")
}

export function checkTemplate(message: string, template: string) {
  // Build the regex pattern from the template
  const regex = buildRegexFromTemplate(template)

  // Check if the message matches the pattern
  return regex.test(message)
}

export function stripTemplate(message: string, template: string) {
  // Build the regex pattern from the template without anchors
  const regex = buildRegexFromTemplate(template, true)

  // Remove all occurrences of the template and trim whitespace
  return message.replace(regex, "").trim()
}

export function checkMenu(text: string) {
  const menuKeywords = ["menu", "菜单", "菜單"]
  return menuKeywords.includes(text.toLowerCase())
}

export function checkNavigational(message: WhatsappMessageObject) {
  //TODO: implement
  const type = message.type
  if (type == "button" || type == "interactive") {
    return true
  } else if (type == "text") {
    const text = message.text.body
  }
  return false
}
