import util from "util"
import axios from "axios"
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { defineString } from "firebase-functions/params"
import { imageHash } from "image-hash"
import { AppEnv } from "../../appEnv"
import { TIME } from "../../utils/time"

const graphApiVersion = defineString(AppEnv.GRAPH_API_VERSION)
const runtimeEnvironment = defineString(AppEnv.ENVIRONMENT)
const testImageUrl = defineString(AppEnv.TEST_IMAGE_URL)

const graphApiUrl = process.env["GRAPH_API_URL"] || "https://graph.facebook.com"
const telegramApiUrl = process.env["TELEGRAM_API_URL"] || "https://api.telegram.org"
const imageHashSync = util.promisify(imageHash)

if (!admin.apps.length) {
  admin.initializeApp()
}

async function downloadWhatsappMedia(mediaId: string) {
  const token = process.env.WHATSAPP_TOKEN
  //get download URL
  const response = await axios({
    method: "GET", // Required, HTTP method, a string, e.g. POST, GET
    url: `${graphApiUrl}/${graphApiVersion.value()}/${mediaId}`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  let url = response?.data?.url
  let responseBuffer
  if (url) {
    try {
      //download image and upload to cloud storage
      responseBuffer = await axios({
        method: "GET",
        url: url,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "arraybuffer",
      })
    } catch (err) {
      functions.logger.log(err)
      throw new Error(
        "Error occured while downloading and calculating hash of image"
      )
    }
  } else {
    throw new Error("Error occured while fetching image url from Facebook")
  }
  return Buffer.from(responseBuffer.data)
}

async function downloadTelegramMedia(mediaId: string) {
  const botToken = process.env.TELEGRAM_USER_TOKEN
  //call getFile method to get filepath from bot, returns a File object
  let response
  try {
    response = await axios({
      method: "GET", // Required, HTTP method, a string, e.g. POST, GET
      url: `${telegramApiUrl}/bot${botToken}/getFile?file_id=${mediaId}`,
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
    })
  } catch (err) {
    functions.logger.log(err)
    throw new Error("Error occured while fetching image file path from Telegram")
  }
  
  let filePath = response?.data?.file_path
  let url =  `${telegramApiUrl}/file/bot${botToken}/${filePath}`
  let responseBuffer
  //TODO: check if file path is valid (how does the downloading and uploading to storage happen)
  if (filePath) {
    try {
      //download image and upload to cloud storage
      responseBuffer = await axios({
        method: "GET",
        url: url,
        headers: {
          Authorization: `Bearer ${botToken}`,
        },
        responseType: "arraybuffer",
      })
    } catch (err) {
      functions.logger.log(err)
      throw new Error(
        "Error occured while downloading and calculating hash of image"
      )
    }
  } else {
    throw new Error("Error occured while fetching image url from Telegram")
  }
  return Buffer.from(responseBuffer.data)
}

async function getHash(buffer: Buffer): Promise<string> {
  const result = (await imageHashSync(
    {
      data: buffer,
    },
    8,
    true
  )) as string
  return result
}

async function getSignedUrl(storageUrl: string) {
  if (runtimeEnvironment.value() === "DEV") {
    return testImageUrl.value()
  }
  try {
    const storage = admin.storage()
    const [temporaryUrl] = await storage
      .bucket()
      .file(storageUrl)
      .getSignedUrl({
        action: "read",
        expires: Date.now() + TIME.ONE_HOUR,
      })
    return temporaryUrl
  } catch (error) {
    functions.logger.error(error)
    return null
  }
}

function getCloudStorageUrl(storageUrl: string) {
  const bucketName = admin.storage().bucket().name
  return `gs://${bucketName}/${storageUrl}`
}

export { downloadWhatsappMedia, downloadTelegramMedia, getHash, getSignedUrl, getCloudStorageUrl }
