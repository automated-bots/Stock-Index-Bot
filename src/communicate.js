const AlertLevels = require('./alertLevelsEnum')
const Util = require('./util')
const fs = require('fs')
const TEMP_VOL_FILE = './tmp-vol.json'
const TEMP_STOCK_FILE = './tmp-stock.json'

class Communicate {
  /**
   * @param {Object} bot Telegram Bot Object
   * @param {Dict} volatilityAlerts Volatility alert thresholds
   * @param {Number} botChatID Chat ID number
   */
  constructor (bot, volatilityAlerts, botChatID) {
    this.bot = bot
    this.volatilityAlerts = volatilityAlerts
    this.botChatID = botChatID
    this.sendMessageOptions = { parse_mode: 'markdown', disable_web_page_preview: true }
    // Notify channel about Bot booting-up (commented-out for now)
    this.sendTelegramMessage('(Re)starting-up Bot... 🤓')
  }

  /**
   * Send message to Telegram channel about volatility (only when needed).
   * It will send you a message only when the VIX index detected a change in the alert levels
   *
   * @param {Object} result Volatility result structure
   */
  sendVolatilityUpdate (result) {
    let sendMessage = false
    const currentLatestTime = result.latest_time.getTime()
    let message = '❗*Stock Alert*❗\n^VIX ticker changed alert level: '
    // Inform the user regarding the change in alert level
    message += this.volatilityAlertToString(result.level)

    if (fs.existsSync(TEMP_VOL_FILE)) {
      const data = this.readContent(TEMP_VOL_FILE)
      sendMessage = ((data.level !== result.level) && (currentLatestTime > data.time))
    } else {
      sendMessage = true // Always send a message the first time, if file does not yet exists.
    }

    if (sendMessage) {
      if (result.alert && result.level !== AlertLevels.NO_ALERT) {
        message += '\n\n'
        const dateString = Util.dateToString(result.latest_time)
        message += `CBOE Volatility Index (^VIX): *${result.percentage}%*. Latest Close: ${result.latest_close_price}. Latest date: ${dateString}.`
        if (result.all_points) {
          message += ' _Market is closed now._'
        }
        message += '\n\n[Open ^VIX Chart](https://www.tradingview.com/chart?symbol=TVC%3AVIX)'
        this.sendTelegramMessage(message)

        // Process dual-alert (if applicable)
        if (result.dual_alert.alert) {
          let dualMessage = '❗*Stock Alert*❗\nVIX ticker changed twice the alert level within a day: '
          dualMessage += this.volatilityAlertToString(result.dual_alert.level) + '!\n'
          dualMessage += `CBOE Volatility Index (^VIX): *${result.dual_alert.percentage}%*`
          this.sendTelegramMessage(dualMessage)
        }
      } else {
        // Back to normal: curently no alert and still a change in alert level (with respect to previous alert level)
        this.sendTelegramMessage(message)
      }
    } else {
      console.log('DEBUG: No new volatility change detected. Do not send a message.')
    }

    // Write data to disk
    const volatilTempData = {
      level: result.level,
      time: currentLatestTime
    }
    this.writeContent(TEMP_VOL_FILE, volatilTempData)
  }

  /**
   * Send message to Telegram channel about stock market (only when needed).
   * It will send you a message whenever there is a MACD cross detected in the PPO histogram.
   *
   * @param {Object} result Stock market result structure
   */
  sendStockMarketUpdate (result) {
    let messageSent = false
    for (const cross of result.crosses) {
      let sendMessage = false
      // Only send messages that are newer that the previous send onces (don't spam)
      const currentTime = cross.time.getTime()

      if (fs.existsSync(TEMP_STOCK_FILE)) {
        const data = this.readContent(TEMP_STOCK_FILE)
        sendMessage = (currentTime > data.time)
      } else {
        sendMessage = true // Always send a message the first time, if file does not yet exists.
      }

      if (sendMessage) {
        let message = '❗*Stock Alert*❗\nS&P 500 index (^SPX) changed in market trend: '
        const dateString = Util.dateToString(cross.time, true)
        const histogram = cross.hist.toFixed(4)
        const prevHistogram = cross.prevHist.toFixed(4)
        const high = cross.high.toFixed(1)
        const low = cross.low.toFixed(1)
        const close = cross.close.toFixed(1)
        switch (cross.type) {
          case 'bearish':
            message += 'towards a bearish trend 🌧.'
            break
          case 'bullish':
            message += 'towards a bullish trend 🔆!'
            break
        }
        message += `\n\nHistogram: ${histogram}% (before: ${prevHistogram}%). High: ${high}. Low: ${low}. Close: ${close}. MACD cross date: ${dateString}.`
        message += '\n\n[Open ^SPX Chart](https://www.tradingview.com/chart?symbol=SP%3ASPX)'
        this.sendTelegramMessage(message)
        messageSent = true // Only for debug logging

        // Write data to disk
        this.writeContent(TEMP_STOCK_FILE, {
          time: currentTime
        })
      }
    }
    if (messageSent === false) {
      console.log('DEBUG: No new S&P500 index crosses detected. Do not send a message update.')
    }
  }

  /**
   * Helper method for sending the message to Telegram bot
   */
  sendTelegramMessage (message) {
    console.log('INFO: Sending following message to Telegram channel: ' + message)

    this.bot.sendMessage(this.botChatID, message, this.sendMessageOptions).catch(error => {
      console.log('ERROR: Could not send Telegram message: "' + message + '", due to error: ' + error.message)
    })
  }

  /**
   * Convert volatility alert number to string
   * @param {number} level - Alert level (alert levels enum)
   */
  volatilityAlertToString (level) {
    switch (level) {
      case AlertLevels.NO_ALERT:
        return `^VIX returned to normal levels (>= ${this.volatilityAlerts.low_threshold}% and < ${this.volatilityAlerts.high_threshold}%). No alert.`
      case AlertLevels.EXTREME_LOW_LEVEL:
        return `Extreme low limit threshold (${this.volatilityAlerts.extreme_low_threshold}%) of ^VIX has been reached.`
      case AlertLevels.LOW_LEVEL:
        return `Low limit threshold (${this.volatilityAlerts.low_threshold}%) of ^VIX has been reached.`
      case AlertLevels.HIGH_LEVEL:
        return `High limit threshold (${this.volatilityAlerts.high_threshold}%) of ^VIX has been reached.`
      case AlertLevels.EXTREME_HIGH_LEVEL:
        return `Extreme high limit threshold (${this.volatilityAlerts.extreme_high_threshold}%) of ^VIX has been reached.`
      default:
        return 'Error: Unknown alert level?'
    }
  }

  readContent (fileName) {
    let data = {}
    try {
      const raw = fs.readFileSync(fileName)
      data = JSON.parse(raw)
    } catch (err) {
      console.error(err)
    }
    return data
  }

  writeContent (fileName, content) {
    const data = JSON.stringify(content)
    try {
      fs.writeFileSync(fileName, data)
    } catch (err) {
      console.error(err)
    }
  }
}

module.exports = Communicate
