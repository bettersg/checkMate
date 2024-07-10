import { sendTelegramTextMessage } from "./sendTelegramMessage"

interface InstanceObj {
  storageUrl: string
  caption: string
}

// Sends a text message to the repost bot
export function repostText(instance: any) {
  const instanceText = "New Message Sent in: \n\n" + instance?.text
  return sendTelegramTextMessage("repost", -1002240751407, instanceText, null)
}

// Sends an image message to the repost bot
export function repostImage(instance: any) {
  const instanceText = "New Image Sent in: \n\n" + instance?.caption
  return sendTelegramTextMessage("repost", -1002240751407, instanceText, null)
}

// Sends a text message to the repost bot to update
export function repostUpdate(instanceText: string, responseText: string) {
  const updateText =
    "Results for previous message: \n\n" +
    instanceText +
    "\n\n" +
    "Category:\n" +
    responseText
  return sendTelegramTextMessage("repost", -1002240751407, updateText, null)
}

/*
TODO
- Reassess for every isAssessed flag
- Add tags for instances that dont reach voting
- Find messageID
- Clear history after a certain time
*/
