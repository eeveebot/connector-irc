"use strict";

import { EventEmitter } from "events";
import * as crypto from "crypto";

import { default as IRC } from "irc-framework";

import { log } from "./log.mjs";

export class IrcClient extends EventEmitter {
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
    this.instanceIdent = `${process.env.HOSTNAME}-${config.name}`;
    this.instanceUUID = crypto.randomUUID();
    this.channels = [];
    this.irc = new IRC.Client();

    // When we join a channel, update our list of channels
    this.irc.on("join", (data) => {
      log.info(`joined channel ${data.channel}`, {
        producer: "ircClient",
        instanceUUID: this.instanceUUID,
      });
      this.updateStatus("channels", this.status.channels.concat(data.channel));
    });

    // When we connect to a server, run any post-connect actions
    this.irc.on("connected", (data) => {
      log.info(
        `client connected to ${this.connectionOptions.host} as ${data.nick}`,
        {
          producer: "ircClient",
          instanceUUID: this.instanceUUID,
        }
      );

      this.updateStatus("ircConnected", true);
      this.updateStatus("remoteHost", this.connectionOptions.host);
      this.updateStatus("currentNick", data.nick);
      if (this.postConnect?.join) {
        setTimeout(() => {
          // Sort the join actions based on the sequence key
          const sortedJoins = this.postConnect.join.sort(
            (a, b) => a.sequence - b.sequence
          );
          log.info(`found ${sortedJoins.length} channels to join`, {
            producer: "ircClient",
            instanceUUID: this.instanceUUID,
          });
          sortedJoins.forEach((chan) => {
            log.info(`joining channel ${chan.channel}`, {
              producer: "ircClient",
              instanceUUID: this.instanceUUID,
            });
            this.join({ name: chan.channel, key: chan.key || "" });
          });
        }, 2500);
      }
    });

    // Passthrough all events
    this.irc.on("registered", (...args) => {
      this.emit("registered", ...args);
    });

    this.irc.on("connected", (...args) => {
      this.emit("connected", ...args);
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

    this.irc.on("message", (...args) => {
      this.emit("message", ...args);
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

  // join joins the bot to a channel
  join(channel) {
    // Push the channel+key to the array for later use
    this.channels.push(channel);
    this.irc.join(channel.name, channel.key || "");
  }

  // connect() connects the IrcClient to the configured server
  //           it also handles postConnect.join actions
  connect() {
    log.info(`client connecting to ${this.connectionOptions.host}`, {
      producer: "ircClient",
      instanceUUID: this.instanceUUID,
    });
    this.irc.connect(this.connectionOptions);
  }

  quit(msg) {
    this.irc.quit(msg || this.ident.quitMsg);
  }

  updateStatus(field, value) {
    this.status[field] = value;
  }
}
