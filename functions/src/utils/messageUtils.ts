interface MessageParams {
  [key: string]: string | number
}

export function replaceTemplatePlaceholders(
  templateText: string,
  params: MessageParams
): string {
  return Object.entries(params).reduce((message, [key, value]) => {
    const placeholder = `{{${key}}}`
    return message.replace(new RegExp(placeholder, "g"), String(value))
  }, templateText)
}