# Stock Market Index Alert Bot

`index-bot` is an open-source stock (forex) bot that uses the the following data to notify the user via Telegram.

For now it's using the following market data:

- [Volatility Index](https://www.tradingview.com/chart?symbol=TVC%3AVIX) - [VIX CBOE](http://www.cboe.com/products/vix-index-volatility/volatility-indexes)
- [S&P500 Index](https://www.tradingview.com/chart?symbol=SP%3ASPX) - [companies by Weight](https://www.slickcharts.com/sp500) (aka S&P 500 index)

This bot will inform you via Telegram, when a certain threshold limit is reached on the VIX volatility market index (on NYSE)
and or whenever there is an up- or downtrend in the S&P 500 market. Technical analysis is applied to determine the up- or downtrend of the S&P 500 index.

## Requirements

This bot is written in JavaScript and run on NodeJS.

- [NodeJS LTS](https://nodejs.org/en/download/)
- [pnpm](https://pnpm.io/)

### Install prerequisites

Node.js:

```sh
curl -sL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

`pnpm` package manager:

```sh
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

## Usage

You can join the public [Stock Exchange Telegram channel](https://t.me/stock_exchange_updates), where this bot is connected to.

_Or_ since this project is open-source, you can setup your own `index-bot` as well as your own [Telegram Bot](https://core.telegram.org/bots). See below.

## Run it yourself

### Docker

Use the [DockerHub Docker image](https://hub.docker.com/repository/docker/danger89/index-bot) (see also: [Dockerfile](Dockerfile)).

1. Copy/rename the [config template file](configTemplate.yml) to `config.yml`, can be stored anywhere on your machine:

   ```sh
   cp configTemplate.yml config.yml
   ```

2. Now change the `config.yml` to your needs (see "Most important Settings" section below).
3. Start Docker container by providing the `config.yml` from outside the Docker container (by default using current working directory, `pwd`, on your host machine):

   ```sh
   docker run --restart always -p 127.0.0.1:3008:3008 -v $(pwd)/config.yml:/app/config.yml -d danger89/index-bot
   ```

_Note:_ The command above should pull the image automatically from Docker Hub.

You can also use `docker-compose`, see [docker-compose.yml](docker-compose.yml).

### Plain terminal

Follow the steps:

1. Copy the config template to `config.yml`: `cp configTemplate.yml config.yml`
2. Change the configuration settings, webhook domain for Telegram bot and API keys for the stock data
3. Install dependencies via: `pnpm install` (once needed)
4. Start the bot using: `pnpm start`

During development you could use: `pnpm run start-fake`. Which will start the app, but **not** connect to the TwelveData API.

**Advice:** Run the bot 24/7 on some dedicated hardware. `cron_time` within the configuration will take care of the triggers when to look-up for data.

**Hidden feature:** Set `DEBUG` to `true` value in the [dataProcessor.js](src/dataProcessor.js) source file to dump the market data to a comma-seperated values (CSV) file. Useful for off-line verification/calculations.

### Most important Settings

The following settings require definitely some attention during setup:

- `exchange_settings -> use_cache` - Set to `False` to not use any local caching, needed for production!
- `exchange_settings -> api_key` - TwelveData API Key (create one on [their site](https://twelvedata.com/login))
- `telegram_settings -> bot_token` - Token from Telegram, created via [@BotFather](https://telegram.me/BotFather)
- `telegram_settings -> public_url` - Telegram public URL for Webhook
- `telegram_settings -> chat_id` - Telegram channel name including '@' or any other chat ID.

There are also 2 environment variables available to set:

- `HOST` (default: `0.0.0.0`)
- `PORT` (default: `3008`)

## License

[MIT License](LICENSE)

## Useful links

- [More info about VIX](https://www.veb.net/artikel/06263/7-vragen-over-de-vix-index) (Dutch)
- [More info about S&P 500](https://www.lynx.nl/kennis/artikelen/sp-500-index-alles-populairste-speler/) (Dutch)
