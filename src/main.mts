// nodejs natives
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// 3rd party
import * as yaml from 'js-yaml';

// 1st party
import { IrcClient } from './lib/irc-client.mjs';
import * as IRC from 'irc-framework';
import { NatsClient, handleSIG, log, eeveeLogo } from '@eeveebot/libeevee';

// Every module has a uuid
const moduleUUID = 'a3e978d9-33af-4d5c-b750-8b3c82e9ee17';

// This is mainly for cosmetics, used in quitmsg by default
const connectorVersion = '0.4.24';

// This is of vital importance.

console.log(eeveeLogo);

log.info(`eevee-irc-connector v${connectorVersion} starting up`, {
  producer: 'core',
});

const ircClients: IrcClient[] = [];
const natsClients: InstanceType<typeof NatsClient>[] = [];
const natsSubscriptions: string[] = [];

//
// Do whatever teardown is necessary before calling common handler
process.on('SIGINT', async () => {
  ircClients.forEach((ircClient) => {
    ircClient.quit(`SIGINT received - ${ircClient.ident.quitMsg}`);
  });
  natsClients.forEach((natsClient) => {
    void natsClient.drain();
  });
  await handleSIG('SIGINT');
});

process.on('SIGTERM', async () => {
  ircClients.forEach((ircClient) => {
    ircClient.quit(`SIGTERM received - ${ircClient.ident.quitMsg}`);
  });
  natsClients.forEach((natsClient) => {
    void natsClient.drain();
  });
  await handleSIG('SIGTERM');
});

//
// Setup NATS connection

// Get host and token
const natsHost = process.env.NATS_HOST || false;
if (!natsHost) {
  const msg = 'environment variable NATS_HOST is not set.';
  log.error(msg, { producer: 'natsClient' });
  throw new Error(msg);
}

const natsToken = process.env.NATS_TOKEN || false;
if (!natsToken) {
  const msg = 'environment variable NATS_TOKEN is not set.';
  log.error(msg, { producer: 'natsClient' });
  throw new Error(msg);
}

const nats = new NatsClient({
  natsHost: natsHost as string,
  natsToken: natsToken as string,
});
natsClients.push(nats);
await nats.connect();

void nats
  .subscribe('control.connectors.irc.core.>', (subject, message) => {
    log.info(subject, { producer: 'natsClient', message: message.string() });
  })
  .then((sub) => {
    if (sub && typeof sub === 'string') natsSubscriptions.push(sub);
  });

//
// Setup IRC connections from config file

// Get path to config file from env.MODULE_CONFIG_PATH
const configFilePath =
  process.env.MODULE_CONFIG_PATH || false;
if (!configFilePath) {
  const msg = 'environment variable MODULE_CONFIG_PATH is not set.';
  log.error(msg, { producer: 'ircClient' });
  throw new Error(msg);
}

let connectionsConfig: unknown = null;

// Read it in and parse it
try {
  const configFileContent = fs.readFileSync(
    path.resolve(configFilePath as string),
    'utf8'
  );
  connectionsConfig = yaml.load(configFileContent);

  log.info(`config loaded from ${configFilePath}`, {
    producer: 'ircClient',
  });
} catch (error: unknown) {
  const msg = `error reading or parsing the config file: ${error}`;
  log.error(msg, { producer: 'ircClient' });
  throw new Error(msg);
}

interface IdentConfig {
  quitMsg: string;
  gecos?: string;
  nick?: string;
  username?: string;
  version?: string;
}

interface ChannelJoinConfig {
  channel: string;
  key?: string;
}

interface PostConnectAction {
  action: string;
  join?: ChannelJoinConfig[];
}

interface IrcConfig {
  autoReconnectMaxRetries?: number;
  autoReconnectWait?: number;
  autoReconnect?: boolean;
  autoRejoinMaxRetries?: number;
  autoRejoinWait?: number;
  autoRejoin?: boolean;
  host?: string;
  nick?: string;
  pingInterval?: number;
  pingTimeout?: number;
  port?: number | string;
  ssl?: boolean;
  username?: string;
}

interface IrcCommands {
  commonPrefixRegex?: string;
}

interface ConnectionConfig {
  name: string;
  ident: IdentConfig;
  irc: IrcConfig;
  postConnect: PostConnectAction[];
  commands?: IrcCommands;
}

// Stand up the connection for each config
(connectionsConfig as { connections: ConnectionConfig[] }).connections.forEach(
  (conn: ConnectionConfig) => {
    log.info(`setting up irc connection for ${conn.name}`, {
      producer: 'ircClient',
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
        gecos: conn.ident.gecos || 'eevee.bot',
        host: conn.irc.host || 'localhost',
        nick: conn.ident.nick || 'eevee',
        ping_interval: conn.irc.pingInterval || 30,
        ping_timeout: conn.irc.pingTimeout || 120,
        port: conn.irc.port || '6667',
        ssl: conn.irc.ssl || false,
        username: conn.ident.username || 'eevee',
        version: conn.ident.version || connectorVersion,
      },
    });

    ircClients.push(client);

    client.connect();

    // When we connect to a server, run any post-connect actions
    client.on('connected', () => {
      // Do connected actions
    });

    // Subscribe to control messages for this client
    void nats
      .subscribe(
        `control.chatConnectors.irc.${client.name}`,
        (subject, message) => {
          try {
            const controlMessage = JSON.parse(message.string());
            log.info('Control message received', {
              producer: 'ircClient',
              subject: subject,
              action: controlMessage.action,
              data: controlMessage.data,
            });

            switch (controlMessage.action) {
              case 'join':
                if (controlMessage.data && controlMessage.data.channel) {
                  client.join({
                    name: controlMessage.data.channel,
                    key: controlMessage.data.key || '',
                  });
                }
                break;
              case 'part':
                if (controlMessage.data && controlMessage.data.channel) {
                  client.part(controlMessage.data.channel);
                }
                break;
              default:
                log.warn('Unknown control action', {
                  producer: 'ircClient',
                  action: controlMessage.action,
                });
            }
          } catch (error) {
            log.error('Error processing control message', {
              producer: 'ircClient',
              error: error,
            });
          }
        }
      )
      .then((sub) => {
        if (sub && typeof sub === 'string') natsSubscriptions.push(sub);
      });

    client.on('join', (data: IRC.JoinData) => {
      void nats
        .subscribe(
          `chat.message.outgoing.irc.${client.name}.${data.channel}`,
          (subject, ipcMessage) => {
            const outgoingMessage = JSON.parse(ipcMessage.string());
            log.info('Outgoing message', {
              producer: 'ircClient',
              subject: subject,
              text: outgoingMessage.text,
            });
            client.say(data.channel, outgoingMessage.text);
          }
        )
        .then((sub) => {
          if (sub && typeof sub === 'string') natsSubscriptions.push(sub);
        });
    });

    client.on('message', (data: IRC.MessageData) => {
      const message = {
        producer: 'ircClient',
        subject: `chat.message.incoming.irc.${client.name}.${data.target}.${data.nick}@${data.hostname}`,
        moduleUUID: moduleUUID,
        type: 'chat.message.incoming',
        trace: crypto.randomUUID(),
        platform: 'irc',
        instance: client.name,
        network: client.status.remoteHost,
        channel: data.target,
        user: data.nick,
        userHost: data.hostname,
        text: data.message,
        commonPrefixRegex: conn.commands?.commonPrefixRegex,
        rawEvent: data,
      };
      void nats.publish(
        `chat.message.incoming.irc.${client.name}.${data.target}.${data.nick}`,
        JSON.stringify(message)
      );
      log.info(`message received`, message);
    });
  }
);
