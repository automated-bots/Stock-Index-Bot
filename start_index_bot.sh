#!/usr/bin/env bash
docker run -p 3008:3008 --restart=always -v $(pwd)/config.yml:/app/config.yml -v $(pwd)/tmp:/app/tmp -d danger89/index-bot
