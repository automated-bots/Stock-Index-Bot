#!/usr/bin/env bash
docker build -t danger89/index-bot -t registry.melroy.org/melroy/index-bot/index-bot:latest .

# Push the images to the DockerHub and the GitLab registry
docker push danger89/index-bot:latest
docker push registry.melroy.org/melroy/index-bot/index-bot:latest
