#!/bin/bash

# where this .sh file lives
DIRNAME=$(dirname "$0")
SCRIPT_DIR=$(cd "$DIRNAME" || exit 1; pwd)
cd "$SCRIPT_DIR" || exit 1

export IRC_CONNECTIONS_CONFIG_FILE="${IRC_CONNECTIONS_CONFIG_FILE:-"${SCRIPT_DIR}/samples/irc.yaml"}"
export NODE_ENV="${NODE_ENV:-development}"

node src/main.mjs
