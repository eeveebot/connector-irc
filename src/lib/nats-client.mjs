"use strict";

import { EventEmitter } from "events";
import * as crypto from "crypto";

import * as Nats from "nats";

import { log } from "./log.mjs";

export class NatsClient extends EventEmitter {
  name = "";
  instanceUUID = "";
  instanceIdent = "";

  subjects = [];

  nats = null;

  natsHost = null;
  natsToken = null;

  sc = Nats.StringCodec();

  constructor(config) {
    super();
    this.instanceUUID = crypto.randomUUID();
    this.subjects = config.subjects || [];
    this.natsHost = config.natsHost;
    this.natsToken = config.natsToken;
  }

  async connect() {
    try {
      this.nats = await Nats.connect({
        servers: this.natsHost,
        token: this.natsToken,
      });
      log.info(`connected to NATS at ${this.nats.getServer()}`, {
        producer: "natsClient",
      });
    } catch (err) {
      log.error(err.message, { producer: "natsClient" });
    }
  }

  async subscribe(subject, callback) {
    const sub = this.nats.subscribe(subject);
    this.subjects.push(sub);
    (async () => {
      for await (const message of sub) {
        log.info(`[${message.subject}][${sub.getProcessed()}]: ${message.string()}`, { producer: "natsClient" });
        if (typeof callback == "function") {
          callback(subject, message);
        }
      }
      log.info("subscription closed", { producer: "natsClient" });
    })();
  }

  async publish(subject, message) {
    this.nats.publish(subject, message);
  }

  async drain() {
    await this.nats.drain();
  }
}
