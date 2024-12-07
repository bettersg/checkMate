import crypto from "crypto"

const decryptRequest = (body: any, privatePem: string, passphrase: string) => {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body

  const privateKey = crypto.createPrivateKey({
    key: privatePem,
    passphrase: passphrase,
  })

  // Decrypt the AES key created by the client
  const decryptedAesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encrypted_aes_key, "base64")
  )

  // Decrypt the Flow data
  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64")
  const initialVectorBuffer = Buffer.from(initial_vector, "base64")

  const TAG_LENGTH = 16
  const encrypted_flow_data_body = flowDataBuffer.subarray(0, -TAG_LENGTH)
  const encrypted_flow_data_tag = flowDataBuffer.subarray(-TAG_LENGTH)

  const decipher = crypto.createDecipheriv(
    "aes-128-gcm",
    decryptedAesKey,
    initialVectorBuffer
  )
  decipher.setAuthTag(encrypted_flow_data_tag)

  const decryptedJSONString = Buffer.concat([
    decipher.update(encrypted_flow_data_body),
    decipher.final(),
  ]).toString("utf-8")

  return {
    decryptedBody: JSON.parse(decryptedJSONString),
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer,
  }
}

const encryptResponse = (
  response: any,
  aesKeyBuffer: Buffer,
  initialVectorBuffer: Buffer
) => {
  // Flip the initialization vector
  const flipped_iv = []
  for (const pair of initialVectorBuffer.entries()) {
    flipped_iv.push(~pair[1])
  }
  // Encrypt the response data
  const cipher = crypto.createCipheriv(
    "aes-128-gcm",
    aesKeyBuffer,
    Buffer.from(flipped_iv)
  )
  return Buffer.concat([
    cipher.update(JSON.stringify(response), "utf-8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64")
}

export { decryptRequest, encryptResponse }
