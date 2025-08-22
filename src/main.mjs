'use strict';

// nodejs natives
import * as fs from 'fs';
import * as path from 'path';

// 3rd party
import * as yaml from 'js-yaml';
import { default as IRC } from 'irc-framework';

// 1st party
import { log, eeveeLogo } from './lib/log.mjs';
import { handleSIG } from './lib/signal-handlers.mjs';

const connectorVersion = '0.4.20';

// This is of vital importance.
// eslint-disable-next-line no-console
console.log(eeveeLogo);

log.info(`[core] eevee-irc-connector v${connectorVersion} starting up`);

//
// Do whatever teardown is necessary before calling common handler
process.on('SIGINT', () => {
  ircClient.quit(`eevee-irc-connector v${connectorVersion}`);
  handleSIG('SIGINT');
});

process.on('SIGTERM', () => {
  ircClient.quit(`eevee-irc-connector v${connectorVersion}`);
  handleSIG('SIGTERM');
});

//
// Setup IRC connection from config file

// Get path to config file from env.CONNECTOR_IRC_CONFIG_FILE
const configFilePath = process.env.CONNECTOR_IRC_CONFIG_FILE;
if (!configFilePath) {
  const msg = "[core] environment variable CONNECTOR_IRC_CONFIG_FILE is not set.";
  log.error(msg);
  throw new Error(msg);
}

var config = null;

// Read it in and parse it
try {
  const configFileContent = fs.readFileSync(path.resolve(configFilePath), 'utf8');
  config = yaml.load(configFileContent);

  log.info(`[core] config loaded from ${configFilePath}`);
} catch (error) {
  const msg = `[core] error reading or parsing the config file: ${error}`;
  log.error(msg);
  throw new Error(msg);
}

// Stand up the connection
log.info("[ircClient] setting up irc connection");
const ircClient = new IRC.Client();

const ircConnectionOptions = {
  auto_reconnect_max_retries: config.irc.server.autoReconnectMaxRetries || 10,
  auto_reconnect_wait:        config.irc.server.autoReconnectWait || 5000,
  auto_reconnect:             config.irc.server.autoReconnect || true,
  auto_rejoin_max_retries:    config.irc.server.autoRejoiNMaxRetries || 5,
  auto_rejoin_wait:           config.irc.server.autoRejoinWait || 5000,
  auto_rejoin:                config.irc.server.autoRejoin || true,
  gecos:                      config.irc.ident.gecos || 'eevee.bot',
  host:                       config.irc.server.host || 'localhost',
  nick:                       config.irc.ident.nick || 'eevee',
  ping_interval:              config.irc.server.pingInterval || 30,
  ping_timeout:               config.irc.server.pingTimeout || 120,
  port:                       config.irc.server.port || '6667',
  ssl:                        config.irc.server.ssl || false,
  username:                   config.irc.ident.username || 'eevee',
  version:                    config.irc.ident.version || connectorVersion,
};

log.info(`[ircClient] client connecting to ${ircConnectionOptions.host}`);
ircClient.connect(ircConnectionOptions);

ircClient.on('registered', () => {
  log.info(`[ircClient] client connected to ${ircConnectionOptions.host}`);
  config.irc.postConnect.join.forEach((join) => {
    log.info(`[ircClient] joining channel: ${join.channel}`);
    ircClient.join(join.channel, join.password);
  });
});

ircClient.on('message', (data) => {
  log.info({message: `[ircClient] received: [${data.message}]`, raw: data});
});
