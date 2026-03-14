// nodejs natives
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// 3rd party
import * as yaml from 'js-yaml';
import * as chokidar from 'chokidar';

// 1st party
import { IrcClient } from './lib/irc-client.mjs';
import * as IRC from 'irc-framework';
import { NatsClient, handleSIG, log, eeveeLogo } from '@eeveebot/libeevee';

// Record module startup time for uptime tracking
const moduleStartTime = Date.now();

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
  // Close the config file watcher
  if (configFileWatcher) {
    await configFileWatcher.close();
  }
  await handleSIG('SIGINT');
});

process.on('SIGTERM', async () => {
  ircClients.forEach((ircClient) => {
    ircClient.quit(`SIGTERM received - ${ircClient.ident.quitMsg}`);
  });
  natsClients.forEach((natsClient) => {
    void natsClient.drain();
  });
  // Close the config file watcher
  if (configFileWatcher) {
    await configFileWatcher.close();
  }
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

// Subscribe to stats.uptime messages and respond with module uptime
void nats
  .subscribe('stats.uptime', (subject, message) => {
    try {
      const data = JSON.parse(message.string());
      log.info('Received stats.uptime request', {
        producer: 'connector-irc',
        replyChannel: data.replyChannel,
      });

      // Calculate uptime in milliseconds
      const uptime = Date.now() - moduleStartTime;

      // Send uptime back via the ephemeral reply channel
      const uptimeResponse = {
        module: 'connector-irc',
        uptime: uptime,
        uptimeFormatted: `${Math.floor(uptime / 86400000)}d ${Math.floor((uptime % 86400000) / 3600000)}h ${Math.floor((uptime % 3600000) / 60000)}m ${Math.floor((uptime % 60000) / 1000)}s`,
      };

      if (data.replyChannel) {
        void nats.publish(data.replyChannel, JSON.stringify(uptimeResponse));
      }
    } catch (error) {
      log.error('Failed to process stats.uptime request', {
        producer: 'connector-irc',
        error: error,
      });
    }
  })
  .then((sub) => {
    if (sub && typeof sub === 'string') natsSubscriptions.push(sub);
  });

//
// Setup IRC connections from config file

// Get path to config file from env.MODULE_CONFIG_PATH
const configFilePath = process.env.MODULE_CONFIG_PATH || false;
if (!configFilePath) {
  const msg = 'environment variable MODULE_CONFIG_PATH is not set.';
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

// Function to reload configuration and recreate IRC clients
async function reloadConfiguration() {
  log.info('Reloading configuration...', { producer: 'core' });

  try {
    // Disconnect all existing clients
    ircClients.forEach((client) => {
      client.quit('Configuration reload - reconnecting...');
    });

    // Clear the ircClients array
    ircClients.length = 0;

    // Clear NATS subscriptions
    natsSubscriptions.length = 0;

    // Re-read the configuration file
    const configFileContent = fs.readFileSync(
      path.resolve(configFilePath as string),
      'utf8'
    );
    const newConnectionsConfig = yaml.load(configFileContent);

    log.info(`config reloaded from ${configFilePath}`, {
      producer: 'ircClient',
    });

    // Create new clients based on the reloaded configuration
    (
      newConnectionsConfig as { connections: ConnectionConfig[] }
    ).connections.forEach((conn: ConnectionConfig) => {
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

        // Handle outgoing notice messages
        void nats
          .subscribe(
            `chat.notice.outgoing.irc.${client.name}.${data.channel}`,
            (subject, ipcMessage) => {
              const outgoingNotice = JSON.parse(ipcMessage.string());
              log.info('Outgoing notice', {
                producer: 'ircClient',
                subject: subject,
                text: outgoingNotice.text,
              });
              client.notice(data.channel, outgoingNotice.text);
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
          botNick: client.status.currentNick,
          commonPrefixRegex: conn.commands?.commonPrefixRegex,
          rawEvent: data,
        };
        void nats.publish(
          `chat.message.incoming.irc.${client.name}.${data.target}.${data.nick}`,
          JSON.stringify(message)
        );
        log.info(`message received`, message);
      });

      // Handle outgoing notice messages to users (private notices)
      void nats
        .subscribe(
          `chat.notice.outgoing.irc.${client.name}`,
          (subject, ipcMessage) => {
            const outgoingNotice = JSON.parse(ipcMessage.string());
            log.info('Outgoing private notice', {
              producer: 'ircClient',
              subject: subject,
              target: outgoingNotice.target,
              text: outgoingNotice.text,
            });
            client.notice(outgoingNotice.target, outgoingNotice.text);
          }
        )
        .then((sub) => {
          if (sub && typeof sub === 'string') natsSubscriptions.push(sub);
        });
    });
  } catch (error) {
    log.error('Error reloading configuration', {
      producer: 'core',
      error: error,
    });
  }
}

// Watch the config file for changes and reload when it changes
const configFileWatcher = chokidar.watch(configFilePath as string, {
  persistent: true,
  ignoreInitial: false, // Trigger on initial add for initial setup
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 100,
  },
});

configFileWatcher.on('add', async (path: string) => {
  log.info(`Config file added: ${path}`, { producer: 'core' });
  await reloadConfiguration();
});

configFileWatcher.on('change', async (path: string) => {
  log.info(`Config file changed: ${path}`, { producer: 'core' });
  await reloadConfiguration();
});

log.info(`Watching config file for changes: ${configFilePath}`, {
  producer: 'core',
});
