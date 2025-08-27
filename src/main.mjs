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

const ircClients = [];

//
// Do whatever teardown is necessary before calling common handler
process.on('SIGINT', () => {
  ircClients.forEach((ircClient) => {
    ircClient.quit(ircClient.quitMsg);
  });
  handleSIG('SIGINT');
});

process.on('SIGTERM', () => {
  ircClients.forEach((ircClient) => {
    ircClient.quit(ircClient.quitMsg);
  });
  handleSIG('SIGTERM');
});

//
// Setup IRC connection from config file

// Get path to config file from env.CONNECTOR_IRC_CONFIG_FILE
const connectionsConfigFilePath = process.env.IRC_CONNECTIONS_CONFIG_FILE;
if (!connectionsConfigFilePath) {
  const msg = "[core] environment variable IRC_CONNECTIONS_CONFIG_FILE is not set.";
  log.error(msg);
  throw new Error(msg);
}

var connectionsConfig = null;

// Read it in and parse it
try {
  const connectionsConfigFileContent = fs.readFileSync(path.resolve(connectionsConfigFilePath), 'utf8');
  connectionsConfig = yaml.load(connectionsConfigFileContent);

  log.info(`[core] config loaded from ${connectionsConfigFilePath}`);
} catch (error) {
  const msg = `[core] error reading or parsing the config file: ${error}`;
  log.error(msg);
  throw new Error(msg);
}

// Stand up the connection for each config
connectionsConfig.ircConnections.forEach((ircConnection) => {
  log.info(`[ircClient] setting up irc connection for ${ircConnection.name}`);

  const ircClient = new IRC.Client();

  ircClient.quitMsg = ircConnection.ident.quitMsg;

  ircClients.push(ircClient);

  const ircConnectionOptions = {
    auto_reconnect_max_retries: ircConnection.irc.autoReconnectMaxRetries || 10,
    auto_reconnect_wait:        ircConnection.irc.autoReconnectWait || 5000,
    auto_reconnect:             ircConnection.irc.autoReconnect || true,
    auto_rejoin_max_retries:    ircConnection.irc.autoRejoinMaxRetries || 5,
    auto_rejoin_wait:           ircConnection.irc.autoRejoinWait || 5000,
    auto_rejoin:                ircConnection.irc.autoRejoin || true,
    gecos:                      ircConnection.ident.gecos || 'eevee.bot',
    host:                       ircConnection.irc.host || 'localhost',
    nick:                       ircConnection.ident.nick || 'eevee',
    ping_interval:              ircConnection.irc.pingInterval || 30,
    ping_timeout:               ircConnection.irc.pingTimeout || 120,
    port:                       ircConnection.irc.port || '6667',
    ssl:                        ircConnection.irc.ssl || false,
    username:                   ircConnection.ident.username || 'eevee',
    version:                    ircConnection.ident.version || connectorVersion,
  };

  log.info(`[ircClient] client connecting to ${ircConnectionOptions.host}`);
  ircClient.connect(ircConnectionOptions);

  ircClient.on('registered', () => {
    log.info(`[ircClient] client connected to ${ircConnectionOptions.host}`);

    if (ircConnection.irc?.postConnect?.join) {
      // Sort the join actions based on the sequence key
      const sortedJoins = ircConnection.irc.postConnect.join.sort((a, b) => a.sequence - b.sequence);

      sortedJoins.forEach((join) => {
        log.info(`[ircClient] joining channel: ${join.channel}`);
        ircClient.join(join.channel, join.password);
      });
    }
  });

  ircClient.on('message', (data) => {
    log.info({message: `[ircClient] received: [${data.message}]`, raw: data});
  });
});
