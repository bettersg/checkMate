import { WhatsappMessageObject } from "../../types"

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // $& means the whole matched string
}

function buildRegexFromTemplate(template: string) {
  // Escape special regex characters in the template except for placeholders
  const escapedTemplate = escapeRegExp(template)

  // Replace the placeholder {{code}} with the regex pattern for alphanumeric characters
  const pattern = escapedTemplate.replace(
    /\\\{\\\{code\\\}\\\}/g,
    "[a-zA-Z0-9]+"
  )

  // Add start (^) and end ($) anchors to match the entire string
  return new RegExp("^" + pattern + "$")
}

export function checkTemplate(message: string, template: string) {
  // Build the regex pattern from the template
  const regex = buildRegexFromTemplate(template)

  // Check if the message matches the pattern
  return regex.test(message)
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
