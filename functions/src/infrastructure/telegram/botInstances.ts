import { Telegraf } from "telegraf"

const CHECKER_BOT_TOKEN = String(process.env.TELEGRAM_CHECKER_BOT_TOKEN)
const ADMIN_BOT_TOKEN = String(process.env.TELEGRAM_ADMIN_BOT_TOKEN)

const adminBot = new Telegraf(ADMIN_BOT_TOKEN)
const checkerBot = new Telegraf(CHECKER_BOT_TOKEN)

export { checkerBot, adminBot }
