"use strict";

// nodejs natives
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { EventEmitter } from "events"; // Add this line

// 3rd party
import * as yaml from "js-yaml";
import { default as IRC } from "irc-framework";

// 1st party
import { log, eeveeLogo } from "./lib/log.mjs";
import { handleSIG } from "./lib/signal-handlers.mjs";

// Every module has a uuid
const moduleUUID = "a3e978d9-33af-4d5c-b750-8b3c82e9ee17";

// This is mainly for cosmetics, used in quitmsg by default
const connectorVersion = "0.4.20";

// This is of vital importance.
// eslint-disable-next-line no-console
console.log(eeveeLogo);

log.info(`eevee-irc-connector v${connectorVersion} starting up`, {producer: "core"});

const ircClients = [];

class IrcClientInstance extends EventEmitter {
  name = "";
  instanceUUID = "";
  instanceIdent = "";

  status = {
    remoteHost: "",
    channels: [],

  };

  connectionOptions = {
    auto_reconnect_max_retries: "",
    auto_reconnect_wait:        "",
    auto_reconnect:             "",
    auto_rejoin_max_retries:    "",
    auto_rejoin_wait:           "",
    auto_rejoin:                "",
    gecos:                      "",
    host:                       "",
    nick:                       "",
    ping_interval:              "",
    ping_timeout:               "",
    port:                       "",
    ssl:                        "",
    username:                   "",
    version:                    "",
  };

  channels = [];

  irc = IRC.Client;

  constructor(config) {
    super();
    this.name = config.name;
    this.ident = config.ident;
    this.postConnect = config.postConnect;
    this.connectionOptions = config.connectionOptions;
    this.instanceIdent = `${process.env.HOSTNAME}`;
    this.instanceUUID = crypto.randomUUID();
    this.channels = [];
    this.irc = new IRC.Client();

    // Attach all IRC events to the EventEmitter
    this.irc.on("*", (...args) => {
      this.emit(...args);
    });
  }

  join(channel) {
    this.channels.push(channel);
    this.status.channels.push(channel.name);
    this.irc.join(channel.name, channel.key || "");
  }

  connect() {
    log.info(`client connecting to ${this.connectionOptions.host}`, {producer: "ircClient"});

    this.status.remoteHost = this.connectionOptions.host;
    this.irc.connect(this.connectionOptions);

    this.irc.on("registered", () => {
      log.info(`client connected to ${this.connectionOptions.host}`, {producer: "ircClient"});

      if (this.postConnect?.join) {
        // Sort the join actions based on the sequence key
        const sortedJoins = this.postConnect.join.sort((a, b) => a.sequence - b.sequence);
        log.info(`found ${sortedJoins.length} channels to join`, {producer: "ircClient"});
        sortedJoins.forEach((join) => {
          log.info(`joining channel: ${join.channel}`, {producer: "ircClient"});
          this.irc.join({name: join.channel, key: join.key || ""});
        });
      }
    });
  }

  quit() {
    this.irc.quit(this.ident.quitMsg);
  }
}

//
// Do whatever teardown is necessary before calling common handler
process.on("SIGINT", () => {
  ircClients.forEach((ircClient) => {
    ircClient.quit(ircClient.quitMsg);
  });
  handleSIG("SIGINT");
});

process.on("SIGTERM", () => {
  ircClients.forEach((ircClient) => {
    ircClient.quit(ircClient.quitMsg);
  });
  handleSIG("SIGTERM");
});

//
// Setup IRC connection from config file

// Get path to config file from env.CONNECTOR_IRC_CONFIG_FILE
const connectionsConfigFilePath = process.env.IRC_CONNECTIONS_CONFIG_FILE;
if (!connectionsConfigFilePath) {
  const msg = "environment variable IRC_CONNECTIONS_CONFIG_FILE is not set.";
  log.error(msg, {producer: "core"});
  throw new Error(msg);
}

var connectionsConfig = null;

// Read it in and parse it
try {
  const connectionsConfigFileContent = fs.readFileSync(path.resolve(connectionsConfigFilePath), "utf8");
  connectionsConfig = yaml.load(connectionsConfigFileContent);

  log.info(`config loaded from ${connectionsConfigFilePath}`, {producer: "core"});
} catch (error) {
  const msg = `error reading or parsing the config file: ${error}`;
  log.error(msg, {producer: "core"});
  throw new Error(msg);
}

// Stand up the connection for each config
connectionsConfig.ircConnections.forEach((ircConnection) => {
  log.info(`setting up irc connection for ${ircConnection.name}`, {producer: "ircClient"});

  const client = new IrcClientInstance({
    name: ircConnection.name,
    ident: ircConnection.ident,
    connection: ircConnection.irc,
    postConnect: ircConnection.postConnect,
    connectionOptions: {
      auto_reconnect_max_retries: ircConnection.irc.autoReconnectMaxRetries || 10,
      auto_reconnect_wait:        ircConnection.irc.autoReconnectWait || 5000,
      auto_reconnect:             ircConnection.irc.autoReconnect || true,
      auto_rejoin_max_retries:    ircConnection.irc.autoRejoinMaxRetries || 5,
      auto_rejoin_wait:           ircConnection.irc.autoRejoinWait || 5000,
      auto_rejoin:                ircConnection.irc.autoRejoin || true,
      gecos:                      ircConnection.ident.gecos || "eevee.bot",
      host:                       ircConnection.irc.host || "localhost",
      nick:                       ircConnection.ident.nick || "eevee",
      ping_interval:              ircConnection.irc.pingInterval || 30,
      ping_timeout:               ircConnection.irc.pingTimeout || 120,
      port:                       ircConnection.irc.port || "6667",
      ssl:                        ircConnection.irc.ssl || false,
      username:                   ircConnection.ident.username || "eevee",
      version:                    ircConnection.ident.version || connectorVersion,
    }
  });

  ircClients.push(client);

  client.connect();

  client.on("message", (data) => {
    log.info(`message received: [${data.message}]`, {producer: "ircClient", raw: data});
  });
});
