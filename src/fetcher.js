const axios = require('axios')
const fs = require('fs')
const Candle = require('./candle')
const logger = require('./logger')

/**
 * History fetcher to get/load historical data
 */
class Fetcher {
  constructor (exchangeSettings) {
    this.exchangeSettings = exchangeSettings
    // Twelve Data API
    this.api = axios.create({
      baseURL: 'https://api.twelvedata.com',
      timeout: 10000
    })
  }

  /**
   * Get historical information from Alpha Vantage API
   *
   * @param {Object} exchangeParams Params dictionary object containing: 'symbol', 'interval' and 'outputsize'
   */
  async getData (exchangeParams) {
    let cacheFile = 'cachedData.json'
    if (exchangeParams.interval === '1week') {
      cacheFile = 'cachedDataWeekly.json'
    }

    if (fs.existsSync('./' + cacheFile) &&
      this.exchangeSettings.use_cache) {
      const data = fs.readFileSync('./' + cacheFile, 'utf8')
      if (data) {
        return Promise.resolve(JSON.parse(data))
      } else {
        return Promise.reject(new Error('Empty data in history file.'))
      }
    } else {
      const params = {
        symbol: exchangeParams.symbol,
        interval: exchangeParams.interval,
        outputsize: exchangeParams.outputsize,
        order: 'ASC',
        apikey: this.exchangeSettings.api_key
      }
      // Both data arrays should contain data bout OHLC and datetime
      try {
        const response = await this.api.get('/time_series', { params })
        if (!Object.prototype.hasOwnProperty.call(response.data, 'values')) {
          return Promise.reject(new Error('Missing values key in response. HTTP status code: ' + response.status + ' with text : ' + response.statusText + '. Response:\n' + JSON.stringify(response.data)))
        }
        return this.postProcessingTimeseries(response.data.values, cacheFile)
      } catch (error) {
        logger.error(error)
        throw new Error(error)
      }
    }
  }

  /**
   * Helper function for processing index time-series
   * @param {Array} timeseries Time-series candle data
   * @param {String} cacheFile Filename store data to (if cache enabled)
   */
  postProcessingTimeseries (timeseries, cacheFile) {
    if (typeof (timeseries) === 'undefined' || timeseries === null || timeseries.length <= 0) {
      return Promise.reject(new Error('Still invalid or empty data received from API'))
    }
    const series = timeseries.map(value =>
      Candle.createIndex(
        parseFloat(value.open), // Open
        parseFloat(value.high), // High
        parseFloat(value.low), // Low
        parseFloat(value.close), // Close
        new Date(value.datetime).getTime()) // Timestamp in ms since Epoch
    )
    if (series && this.exchangeSettings.use_cache) {
      fs.writeFile('./' + cacheFile, JSON.stringify(series, null, 2), 'utf-8', (err) => {
        if (err) throw err
      })
    }
    return series
  }
}

module.exports = Fetcher
