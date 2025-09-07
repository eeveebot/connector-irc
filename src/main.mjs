"use strict";

// nodejs natives
import * as fs from "fs";
import * as path from "path";

// 3rd party
import * as yaml from "js-yaml";

// 1st party
import { log, eeveeLogo } from "./lib/log.mjs";
import { handleSIG } from "./lib/signal-handlers.mjs";
import { IrcClient } from "./lib/irc-client.mjs";
import { NatsClient } from "./lib/nats-client.mjs";

// Every module has a uuid
const moduleUUID = "a3e978d9-33af-4d5c-b750-8b3c82e9ee17";

// This is mainly for cosmetics, used in quitmsg by default
const connectorVersion = "0.4.20";

// This is of vital importance.
// eslint-disable-next-line no-console
console.log(eeveeLogo);

log.info(`eevee-irc-connector v${connectorVersion} starting up`, {
  producer: "core",
});

const ircClients = [];
const natsClients = [];

//
// Do whatever teardown is necessary before calling common handler
process.on("SIGINT", () => {
  ircClients.forEach((ircClient) => {
    ircClient.quit(`SIGINT received - ${ircClient.ident.quitMsg}`);
  });
  natsClients.forEach((natsClient) => {
    natsClient.drain();
  });
  handleSIG("SIGINT");
});

process.on("SIGTERM", () => {
  ircClients.forEach((ircClient) => {
    ircClient.quit(`SIGTERM received - ${ircClient.ident.quitMsg}`);
  });
  natsClients.forEach((natsClient) => {
    natsClient.drain();
  });
  handleSIG("SIGTERM");
});

//
// Setup NATS connection

// Get host and token
const natsHost = process.env.NATS_HOST || false;
if (!natsHost) {
  const msg = "environment variable NATS_HOST is not set.";
  log.error(msg, { producer: "natsClient" });
  throw new Error(msg);
}

const natsToken = process.env.NATS_TOKEN || false;
if (!natsToken) {
  const msg = "environment variable NATS_TOKEN is not set.";
  log.error(msg, { producer: "natsClient" });
  throw new Error(msg);
}

const nats = new NatsClient({
  natsHost: natsHost,
  natsToken: natsToken,
});
natsClients.push(nats);
await nats.connect();

//
// Setup IRC connections from config file

// Get path to config file from env.CONNECTOR_IRC_CONFIG_FILE
const connectionsConfigFilePath =
  process.env.IRC_CONNECTIONS_CONFIG_FILE || false;
if (!connectionsConfigFilePath) {
  const msg = "environment variable IRC_CONNECTIONS_CONFIG_FILE is not set.";
  log.error(msg, { producer: "ircClient" });
  throw new Error(msg);
}

var connectionsConfig = null;

// Read it in and parse it
try {
  const connectionsConfigFileContent = fs.readFileSync(
    path.resolve(connectionsConfigFilePath),
    "utf8"
  );
  connectionsConfig = yaml.load(connectionsConfigFileContent);

  log.info(`config loaded from ${connectionsConfigFilePath}`, {
    producer: "ircClient",
  });
} catch (error) {
  const msg = `error reading or parsing the config file: ${error}`;
  log.error(msg, { producer: "ircClient" });
  throw new Error(msg);
}

// Stand up the connection for each config
connectionsConfig.ircConnections.forEach((conn) => {
  log.info(`setting up irc connection for ${conn.name}`, {
    producer: "ircClient",
  });

  const client = new IrcClient({
    name: conn.name,
    ident: conn.ident,
    connection: conn.irc,
    postConnect: conn.postConnect,
    connectionOptions: {
      auto_reconnect_max_retries: conn.irc.autoReconnectMaxRetries || 10,
      auto_reconnect_wait: conn.irc.autoReconnectWait || 5000,
      auto_reconnect: conn.irc.autoReconnect || true,
      auto_rejoin_max_retries: conn.irc.autoRejoinMaxRetries || 5,
      auto_rejoin_wait: conn.irc.autoRejoinWait || 5000,
      auto_rejoin: conn.irc.autoRejoin || true,
      gecos: conn.ident.gecos || "eevee.bot",
      host: conn.irc.host || "localhost",
      nick: conn.ident.nick || "eevee",
      ping_interval: conn.irc.pingInterval || 30,
      ping_timeout: conn.irc.pingTimeout || 120,
      port: conn.irc.port || "6667",
      ssl: conn.irc.ssl || false,
      username: conn.ident.username || "eevee",
      version: conn.ident.version || connectorVersion,
    },
  });

  ircClients.push(client);

  client.connect();

  client.on("message", (data) => {
    nats.publish(
      `chat.message.incoming.irc.${client.name}.${data.target}.${data.ident}`,
      JSON.stringify({
        channel: data.target,
        instance: client.ident.nick,
        network: client.name,
        platform: "irc",
        raw_event: data,
        srcUUID: moduleUUID,
        text: data.message,
        trace: crypto.randomUUID(),
        type: "chat.message.incoming",
        user: data.nick,
      })
    );
    log.info(`message received`, {
      producer: "ircClient",
      instanceUUID: client.instanceUUID,
      from_server: data.from_server,
      hostname: data.hostname,
      ident: data.ident,
      message: data.message,
      nick: data.nick,
      tags: data.tags || {},
      target: data.target,
      type: data.type,
      raw: data,
    });
  });
});
