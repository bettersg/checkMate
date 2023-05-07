function classifyText(text) {
  //longer term, should classify into "irrelevant", "legitimate", "scam", "illicit", "spam", or "info". null if cannot
  if (text.length < 15) {
    return 'irrelevant'
  } else {
    return null
  }
}

exports.classifyText = classifyText
