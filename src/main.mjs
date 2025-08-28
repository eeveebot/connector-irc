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

log.info(`eevee-irc-connector v${connectorVersion} starting up`, {
  producer: "core",
});

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
    auto_reconnect_wait: "",
    auto_reconnect: "",
    auto_rejoin_max_retries: "",
    auto_rejoin_wait: "",
    auto_rejoin: "",
    gecos: "",
    host: "",
    nick: "",
    ping_interval: "",
    ping_timeout: "",
    port: "",
    ssl: "",
    username: "",
    version: "",
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

    this.irc.on("registered", (...args) => {
      this.emit("registered", ...args);
    });

    this.irc.on("reconnecting", (...args) => {
      this.emit("reconnecting", ...args);
    });

    this.irc.on("close", (...args) => {
      this.emit("close", ...args);
    });

    this.irc.on("socket close", (...args) => {
      this.emit("socket close", ...args);
    });

    this.irc.on("socket connected", (...args) => {
      this.emit("socket connected", ...args);
    });

    this.irc.on("raw socket connected", (...args) => {
      this.emit("raw socket connected", ...args);
    });

    this.irc.on("server options", (...args) => {
      this.emit("server options", ...args);
    });

    this.irc.on("raw", (...args) => {
      this.emit("raw", ...args);
    });

    this.irc.on("unknown command", (...args) => {
      this.emit("unknown command", ...args);
    });

    this.irc.on("debug", (...args) => {
      this.emit("debug", ...args);
    });

    // Channels
    this.irc.on("channel info", (...args) => {
      this.emit("channel info", ...args);
    });

    this.irc.on("channel list start", (...args) => {
      this.emit("channel list start", ...args);
    });

    this.irc.on("channel list", (...args) => {
      this.emit("channel list", ...args);
    });

    this.irc.on("channel list end", (...args) => {
      this.emit("channel list end", ...args);
    });

    this.irc.on("wholist", (...args) => {
      this.emit("wholist", ...args);
    });

    this.irc.on("userlist", (...args) => {
      this.emit("userlist", ...args);
    });

    this.irc.on("invitelist", (...args) => {
      this.emit("invitelist", ...args);
    });

    this.irc.on("banlist", (...args) => {
      this.emit("banlist", ...args);
    });

    this.irc.on("exceptlist", (...args) => {
      this.emit("exceptlist", ...args);
    });

    this.irc.on("topic", (...args) => {
      this.emit("topic", ...args);
    });

    this.irc.on("topicsetby", (...args) => {
      this.emit("topicsetby", ...args);
    });

    this.irc.on("join", (...args) => {
      this.emit("join", ...args);
    });

    this.irc.on("part", (...args) => {
      this.emit("part", ...args);
    });

    this.irc.on("kick", (...args) => {
      this.emit("kick", ...args);
    });

    this.irc.on("quit", (...args) => {
      this.emit("quit", ...args);
    });

    this.irc.on("invited", (...args) => {
      this.emit("invited", ...args);
    });

    // Messaging
    this.irc.on("notice", (...args) => {
      this.emit("notice", ...args);
    });

    this.irc.on("action", (...args) => {
      this.emit("action", ...args);
    });

    this.irc.on("privmsg", (...args) => {
      this.emit("privmsg", ...args);
    });

    this.irc.on("tagmsg", (...args) => {
      this.emit("tagmsg", ...args);
    });

    this.irc.on("ctcp response", (...args) => {
      this.emit("ctcp response", ...args);
    });

    this.irc.on("ctcp request", (...args) => {
      this.emit("ctcp request", ...args);
    });

    this.irc.on("wallops", (...args) => {
      this.emit("wallops", ...args);
    });

    // Users
    this.irc.on("nick", (...args) => {
      this.emit("nick", ...args);
    });

    this.irc.on("account", (...args) => {
      this.emit("account", ...args);
    });

    this.irc.on("user info", (...args) => {
      this.emit("user info", ...args);
    });

    this.irc.on("away", (...args) => {
      this.emit("away", ...args);
    });

    this.irc.on("back", (...args) => {
      this.emit("back", ...args);
    });

    this.irc.on("monitorlist", (...args) => {
      this.emit("monitorlist", ...args);
    });

    this.irc.on("nick in use", (...args) => {
      this.emit("nick in use", ...args);
    });

    this.irc.on("nick invalid", (...args) => {
      this.emit("nick invalid", ...args);
    });

    this.irc.on("users online", (...args) => {
      this.emit("users online", ...args);
    });

    this.irc.on("users offline", (...args) => {
      this.emit("users offline", ...args);
    });

    this.irc.on("whois", (...args) => {
      this.emit("whois", ...args);
    });

    this.irc.on("whowas", (...args) => {
      this.emit("whowas", ...args);
    });

    this.irc.on("user updated", (...args) => {
      this.emit("user updated", ...args);
    });

    // Misc
    this.irc.on("motd", (...args) => {
      this.emit("motd", ...args);
    });

    this.irc.on("info", (...args) => {
      this.emit("info", ...args);
    });

    this.irc.on("help", (...args) => {
      this.emit("help", ...args);
    });

    this.irc.on("batch start", (...args) => {
      this.emit("batch start", ...args);
    });

    this.irc.on("batch end", (...args) => {
      this.emit("batch end", ...args);
    });

    this.irc.on("cap ls", (...args) => {
      this.emit("cap ls", ...args);
    });

    this.irc.on("cap ack", (...args) => {
      this.emit("cap ack", ...args);
    });

    this.irc.on("cap nak", (...args) => {
      this.emit("cap nak", ...args);
    });

    this.irc.on("cap list", (...args) => {
      this.emit("cap list", ...args);
    });

    this.irc.on("cap new", (...args) => {
      this.emit("cap new", ...args);
    });

    this.irc.on("cap del", (...args) => {
      this.emit("cap del", ...args);
    });

    // SASL
    this.irc.on("loggedin", (...args) => {
      this.emit("loggedin", ...args);
    });

    this.irc.on("loggedout", (...args) => {
      this.emit("loggedout", ...args);
    });

    this.irc.on("sasl failed", (...args) => {
      this.emit("sasl failed", ...args);
    });
  }

  join(channel) {
    this.channels.push(channel);
    this.status.channels.push(channel.name);
    this.irc.join(channel.name, channel.key || "");
  }

  connect() {
    log.info(`client connecting to ${this.connectionOptions.host}`, {
      producer: "ircClient",
    });


    this.irc.on("motd", (data) => {
      log.info(`server motd received`, {
        producer: "ircClient",
        motd: data.motd
      });
    });

    this.irc.on("connected", (data) => {
      log.info(`client connected to ${this.connectionOptions.host} as ${data.nick}`, {
        producer: "ircClient",
      });

      if (this.postConnect?.join) {
        // Sort the join actions based on the sequence key
        const sortedJoins = this.postConnect.join.sort(
          (a, b) => a.sequence - b.sequence
        );
        log.info(`found ${sortedJoins.length} channels to join`, {
          producer: "ircClient",
        });
        sortedJoins.forEach((join) => {
          log.info(`joining channel: ${join.channel}`, {
            producer: "ircClient",
          });
          this.irc.join(join.channel, join.key || "");
        });
      }
    });

    this.status.remoteHost = this.connectionOptions.host;
    this.irc.connect(this.connectionOptions);
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
  log.error(msg, { producer: "core" });
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
    producer: "core",
  });
} catch (error) {
  const msg = `error reading or parsing the config file: ${error}`;
  log.error(msg, { producer: "core" });
  throw new Error(msg);
}

// Stand up the connection for each config
connectionsConfig.ircConnections.forEach((ircConnection) => {
  log.info(`setting up irc connection for ${ircConnection.name}`, {
    producer: "ircClient",
  });

  const client = new IrcClientInstance({
    name: ircConnection.name,
    ident: ircConnection.ident,
    connection: ircConnection.irc,
    postConnect: ircConnection.postConnect,
    connectionOptions: {
      auto_reconnect_max_retries:
        ircConnection.irc.autoReconnectMaxRetries || 10,
      auto_reconnect_wait: ircConnection.irc.autoReconnectWait || 5000,
      auto_reconnect: ircConnection.irc.autoReconnect || true,
      auto_rejoin_max_retries: ircConnection.irc.autoRejoinMaxRetries || 5,
      auto_rejoin_wait: ircConnection.irc.autoRejoinWait || 5000,
      auto_rejoin: ircConnection.irc.autoRejoin || true,
      gecos: ircConnection.ident.gecos || "eevee.bot",
      host: ircConnection.irc.host || "localhost",
      nick: ircConnection.ident.nick || "eevee",
      ping_interval: ircConnection.irc.pingInterval || 30,
      ping_timeout: ircConnection.irc.pingTimeout || 120,
      port: ircConnection.irc.port || "6667",
      ssl: ircConnection.irc.ssl || false,
      username: ircConnection.ident.username || "eevee",
      version: ircConnection.ident.version || connectorVersion,
    },
  });

  ircClients.push(client);

  client.connect();

  client.on("message", (data) => {
    log.info(`message received: [${data.message}]`, {
      producer: "ircClient",
      raw: data,
    });
  });
});
