// NTBA = node-telegram-bot-api fixes
process.env.NTBA_FIX_319 = 1
process.env.NTBA_FIX_350 = 1
// Constants
const port = process.env.PORT || 3008
const host = process.env.HOST || '0.0.0.0'
const isFake = process.env.NODE_ENV === 'fake'

const fs = require('fs')
const YAML = require('yaml')
const Fetcher = require('./fetcher')
const DataProcessor = require('./dataProcessor')
const CronJob = require('cron').CronJob
const crypto = require('crypto')
const TELEGRAM_SECRET_HASH = crypto.randomBytes(20).toString('hex')
const TEST_API_SECRET_HASH = crypto.randomBytes(40).toString('hex')
const TelegramBot = require('node-telegram-bot-api')
const express = require('express')
const Communicate = require('./communicate')
const logger = require('./logger')
const { version } = require('../package.json')

const cfg = YAML.parse(fs.readFileSync('config.yml', 'utf8').toString())
if (!cfg) {
  throw new Error('Please create a config.yml file.')
}
if (cfg.exchange_settings.use_cache) {
  logger.warn('WARN: Cached market data files will be used (if available).')
}

logger.info('INFO: Using Telegram channel chat ID: ' + cfg.telegram_settings.chat_id)
logger.info('INFO: Current test API hash: ' + TEST_API_SECRET_HASH)
logger.info('INFO: VIX index Cron time: \'' + cfg.tickers.volatility.cron_time + '\' with timezone: ' + cfg.tickers.volatility.cron_timezone)
logger.info('INFO: GSPC index Cron time: \'' + cfg.tickers.stockmarket.cron_time + '\' with timezone: ' + cfg.tickers.stockmarket.cron_timezone)

// Setup Telegram bot
const bot = (isFake) ? {} : new TelegramBot(cfg.telegram_settings.bot_token)
// For testing purpose only
if (isFake) {
  bot.setWebHook = (url, options = {}, fileOptions = {}) => { }
  bot.onText = (regexp, callback) => {}
  bot.sendMessage = (chatId, text, form = {}) => {
    return new Promise(function (resolve, reject) {
      logger.info('Send Messaged (just a drill)! Chat ID: ' + chatId + ' with message: ' + text)
      resolve()
    })
  }
}

bot.on('error', (error) => {
  logger.error(error)
  global.ErrorState = true
})

// Inform the Telegram servers of the new webhook url
bot.setWebHook(`${cfg.telegram_settings.public_url}/bot${TELEGRAM_SECRET_HASH}`).catch((error) => {
  logger.error(error)
  global.ErrorState = true
})

// Create API Fetcher, data processor and communication instances
const fetcher = new Fetcher(cfg.exchange_settings)
const dataProcessor = new DataProcessor(cfg.tickers.volatility.alerts,
  cfg.tickers.stockmarket.warmup_period,
  cfg.tickers.stockmarket.data_period,
  cfg.tickers.stockmarket.indicators)
const comm = new Communicate(bot, cfg.tickers.volatility.alerts, cfg.telegram_settings.chat_id)

const app = express()
app.disable('x-powered-by')
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// Receive Telegram updates
app.post(`/bot${TELEGRAM_SECRET_HASH}`, (req, res) => {
  bot.processUpdate(req.body)
  res.sendStatus(200)
})
// Display version
app.get('/', (req, res) => res.send('<h1>Stock market data bot</h1> Stock market index bot v' + version + '. <br/><br/>By: Melroy van den Berg'))

// Test APIs
app.get(`/test_api/${TEST_API_SECRET_HASH}/volatil`, (req, res) => {
  onTickVolatility()
  res.send('OK')
})
app.get(`/test_api/${TEST_API_SECRET_HASH}/stock`, (req, res) => {
  onTickStockMarket()
  res.send('OK')
})

app.get('/health', (req, res) => {
  const statusCode = (global.ErrorState) ? 500 : 200
  res.status(statusCode).json({ health_ok: !global.ErrorState })
})

// Simple ping command
bot.onText(/\/ping/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Pong').catch(error => {
    logger.error('ERROR: Could not send pong message, due to error: ' + error.message)
    global.ErrorState = true
  })
})

/*
// For testing only
const bot = {}
bot.sendMessage = (a, b, c) => {
  return new Promise(function (resolve, reject) {
    reject(new Error('This is just a drill'))
  })
}
*/

// Start Express Server
app.listen(port, host, () => {
  logger.info(`INFO: Market Alert Index Bot v${version} is now running on ${host} on port ${port}.`)
})

/**
 * Triggers on cron job
 */
function onTickVolatility () {
  // Get market data points
  fetcher.getData(cfg.tickers.volatility.params)
    .then(data => {
      const result = dataProcessor.processVolatility(data)
      comm.sendVolatilityUpdate(result)
    })
    .catch(error => {
      logger.error('Error: Something went wrong during getting or processing the volatility data. With message: ' + error.message + '. Stack:\n')
      logger.error(error.stack)
    })
}

function onTickStockMarket () {
  // Get market data points
  fetcher.getData(cfg.tickers.stockmarket.params)
    .then(data => {
      const result = dataProcessor.processStockMarket(data)
      comm.sendStockMarketUpdate(result)
    })
    .catch(error => {
      logger.error('Error: Something went wrong during getting or processing the stock market data. With message: ' + error.message + '. Stack:\n')
      logger.error(error.stack)
    })
}

// Cron job for onTickVolatility()
const job = new CronJob(cfg.tickers.volatility.cron_time, onTickVolatility, null, false, cfg.tickers.volatility.cron_timezone)
job.start()
logger.info('INFO: Cron triggers scheduled for VIX (upcoming 6 shown):\n - ' + job.nextDates(6).join('\n - '))

// Cron job for onTickStockMarket()
const job2 = new CronJob(cfg.tickers.stockmarket.cron_time, onTickStockMarket, null, false, cfg.tickers.stockmarket.cron_timezone)
job2.start()
logger.info('INFO: Cron triggers scheduled for GSPC (upcoming 3 shown):\n - ' + job2.nextDates(3).join('\n - '))
