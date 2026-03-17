// nodejs natives
import * as fs from 'fs';
import * as path from 'path';

// 3rd party
import * as yaml from 'js-yaml';
import * as chokidar from 'chokidar';

// 1st party
import { IrcClient } from './lib/irc-client.mjs';
import { NatsClient, handleSIG, log, eeveeLogo } from '@eeveebot/libeevee';

// Metrics
import {
  initializeSystemMetrics,
  setupHttpServer,
  natsPublishCounter,
  natsSubscribeCounter,
  errorCounter,
} from '@eeveebot/libeevee';
import { messageCounter, register } from './lib/metrics/index.mjs';

// Record module startup time for uptime tracking
const moduleStartTime = Date.now();

// Initialize system metrics
initializeSystemMetrics('connector-irc');

// Setup HTTP API server for metrics
setupHttpServer({
  port: process.env.HTTP_API_PORT || '9000',
  serviceName: 'connector-irc',
});

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
    // Record subscription
    natsSubscribeCounter.inc({
      module: 'connector-irc',
      subject: 'control.connectors.irc.core.>',
    });
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
        natsPublishCounter.inc({
          module: 'connector-irc',
          type: 'uptime_response',
        });
      }
    } catch (error) {
      log.error('Failed to process stats.uptime request', {
        producer: 'connector-irc',
        error: error,
      });

      // Record error
      // Note: errorCounter is not imported, so we'll skip this for now
    }
  })
  .then((sub) => {
    if (sub && typeof sub === 'string') natsSubscriptions.push(sub);
    // Record subscription
    natsSubscribeCounter.inc({
      module: 'connector-irc',
      subject: 'stats.uptime',
    });
  });

// Subscribe to stats.emit.request messages and respond with full module stats
void nats
  .subscribe('stats.emit.request', (subject, message) => {
    try {
      const data = JSON.parse(message.string());
      log.info('Received stats.emit.request', {
        producer: 'connector-irc',
        replyChannel: data.replyChannel,
      });

      // Calculate uptime in milliseconds
      const uptime = Date.now() - moduleStartTime;

      // Get all prom-client metrics
      void register
        .metrics()
        .then((prometheusMetrics) => {
          // Get memory usage information
          const memoryUsage = process.memoryUsage();

          // Send stats back via the ephemeral reply channel
          const statsResponse = {
            module: 'connector-irc',
            stats: {
              uptime_seconds: Math.floor(uptime / 1000),
              uptime_formatted: `${Math.floor(uptime / 86400000)}d ${Math.floor((uptime % 86400000) / 3600000)}h ${Math.floor((uptime % 3600000) / 60000)}m ${Math.floor((uptime % 60000) / 1000)}s`,
              memory_rss_mb: Math.round(memoryUsage.rss / (1024 * 1024)),
              memory_heap_used_mb: Math.round(
                memoryUsage.heapUsed / (1024 * 1024)
              ),
              prometheus_metrics: prometheusMetrics,
            },
          };

          if (data.replyChannel) {
            void nats.publish(data.replyChannel, JSON.stringify(statsResponse));
            natsPublishCounter.inc({
              module: 'connector-irc',
              type: 'stats_response',
            });
          }
        })
        .catch((error) => {
          log.error('Failed to collect prometheus metrics', {
            producer: 'connector-irc',
            error: error,
          });
        });
    } catch (error) {
      log.error('Failed to process stats.emit.request', {
        producer: 'connector-irc',
        error: error,
      });
    }
  })
  .then((sub) => {
    if (sub && typeof sub === 'string') natsSubscriptions.push(sub);
    // Record subscription
    natsSubscribeCounter.inc({
      module: 'connector-irc',
      subject: 'stats.emit.request',
    });
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

interface ControlMessageData {
  channel?: string;
  key?: string;
  nick?: string;
  reason?: string;
  replyChannel?: string;
}

interface ControlMessage {
  action: string;
  data?: ControlMessageData;
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
        commands: conn.commands,
      });

      ircClients.push(client);

      client.connect();

      // When we connect to a server, run any post-connect actions
      client.on('connected', () => {
        // Do connected actions
      });

      // Handle incoming IRC messages and publish to NATS
      client.on('privmsg', (event) => {
        try {
          const message = {
            producer: 'ircClient',
            subject: `chat.message.incoming.irc.${client.name}.${event.target}.${event.nick}`,
            type: 'chat.message.incoming',
            platform: 'irc',
            instance: client.name,
            network: client.connectionOptions.host,
            channel: event.target,
            nick: event.nick,
            user: event.ident,
            userHost: event.hostname,
            text: event.message,
            time: event.time,
            account: event.account,
            botNick: client.status.currentNick || client.connectionOptions.nick,
            commonPrefixRegex: client.commands?.commonPrefixRegex,
            rawEvent: event,
          };

          // Publish to NATS with proper subject format
          void nats.publish(
            `chat.message.incoming.irc.${client.name}.${event.target}.${event.nick}`,
            JSON.stringify(message)
          );

          // Record incoming message
          messageCounter.inc({
            module: 'connector-irc',
            direction: 'incoming',
            result: 'published',
          });

          log.info('Incoming message published to NATS', {
            producer: 'ircClient',
            channel: event.target,
            user: event.nick,
            message: event.message,
          });
        } catch (error) {
          log.error('Error processing incoming IRC message', {
            producer: 'ircClient',
            error: error,
          });

          // Record error
          errorCounter.inc({
            module: 'connector-irc',
            type: 'message',
            operation: 'processing_error',
          });
        }
      });

      // Handle incoming IRC actions (/me commands) and publish to NATS
      client.on('action', (event) => {
        try {
          const message = {
            producer: 'ircClient',
            subject: `chat.message.incoming.irc.${client.name}.${event.target}.${event.nick}`,
            type: 'chat.message.incoming',
            platform: 'irc',
            instance: client.name,
            network: client.connectionOptions.host,
            channel: event.target,
            user: event.nick,
            userHost: event.ident
              ? `${event.nick}!${event.ident}@${event.hostname}`
              : `${event.nick}@${event.hostname}`,
            text: event.message,
            time: event.time,
            account: event.account,
            action: true, // Flag to indicate this is an action message
            botNick: client.status.currentNick || client.connectionOptions.nick,
            commonPrefixRegex: client.commands?.commonPrefixRegex,
            rawEvent: event,
          };

          // Publish to NATS with proper subject format
          void nats.publish(
            `chat.message.incoming.irc.${client.name}.${event.target}.${event.nick}`,
            JSON.stringify(message)
          );

          // Record incoming action
          messageCounter.inc({
            module: 'connector-irc',
            direction: 'incoming',
            result: 'published',
          });

          log.info('Incoming action published to NATS', {
            producer: 'ircClient',
            channel: event.target,
            user: event.nick,
            message: event.message,
          });
        } catch (error) {
          log.error('Error processing incoming IRC action', {
            producer: 'ircClient',
            error: error,
          });

          // Record error
          errorCounter.inc({
            module: 'connector-irc',
            type: 'message',
            operation: 'processing_error',
          });
        }
      });

      // Subscribe to control messages for this client
      void nats
        .subscribe(
          `control.chatConnectors.irc.${client.name}`,
          (subject, message) => {
            try {
              const controlMessage: ControlMessage = JSON.parse(
                message.string()
              );
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
                case 'kick':
                  if (
                    controlMessage.data &&
                    controlMessage.data.channel &&
                    controlMessage.data.nick
                  ) {
                    client.kick(
                      controlMessage.data.channel,
                      controlMessage.data.nick,
                      controlMessage.data.reason
                    );
                  }
                  break;
                case 'list-users-in-channel':
                  if (controlMessage.data && controlMessage.data.channel) {
                    // Send NAMES command to get user list
                    client.irc.raw('NAMES', controlMessage.data.channel);

                    // Track if we've already sent a response
                    let responseSent = false;

                    // Set up one-time listener for userlist event
                    const userlistHandler = (event: {
                      channel: string;
                      users: Array<{
                        nick: string;
                        ident: string;
                        hostname: string;
                        modes: string[];
                      }>;
                    }) => {
                      if (
                        event.channel.toLowerCase() ===
                        controlMessage.data!.channel!.toLowerCase()
                      ) {
                        // Remove listener to prevent memory leaks
                        client.irc.off('userlist', userlistHandler);

                        // Check if we've already sent a response
                        if (responseSent) return;

                        // Mark response as sent
                        responseSent = true;

                        // Send response back via replyChannel if provided
                        if (controlMessage.data!.replyChannel) {
                          const response = {
                            channel: event.channel,
                            users: event.users.map((user) => ({
                              nick: user.nick,
                              ident: user.ident,
                              hostname: user.hostname,
                              modes: user.modes,
                            })),
                            count: event.users.length,
                          };

                          void nats.publish(
                            controlMessage.data!.replyChannel,
                            JSON.stringify(response)
                          );
                          natsPublishCounter.inc({
                            module: 'connector-irc',
                            type: 'user_list_response',
                          });
                        }
                      }
                    };

                    // Attach the listener
                    client.irc.on('userlist', userlistHandler);

                    // Set a timeout to clean up the listener if no response
                    setTimeout(() => {
                      // Check if we've already sent a response
                      if (responseSent) return;

                      // Remove listener to prevent memory leaks
                      client.irc.off('userlist', userlistHandler);

                      // Mark response as sent
                      responseSent = true;

                      if (controlMessage.data!.replyChannel) {
                        const response = {
                          channel: controlMessage.data!.channel,
                          error: 'Timeout waiting for user list',
                          users: [],
                        };
                        void nats.publish(
                          controlMessage.data!.replyChannel,
                          JSON.stringify(response)
                        );
                        natsPublishCounter.inc({
                          module: 'connector-irc',
                          type: 'user_list_timeout',
                        });
                      }
                    }, 10000); // 10 second timeout
                  }
                  break;
                default:
                  log.warn('Unknown control action', {
                    producer: 'ircClient',
                    action: controlMessage.action,
                  });

                  // Record unknown action
                  errorCounter.inc({
                    module: 'connector-irc',
                    type: 'control',
                    operation: 'unknown_action',
                  });
              }
            } catch (error) {
              log.error('Error processing control message', {
                producer: 'ircClient',
                error: error,
              });

              // Record error
              errorCounter.inc({
                module: 'connector-irc',
                type: 'control',
                operation: 'processing_error',
              });
            }
          }
        )
        .then((sub) => {
          if (sub && typeof sub === 'string') natsSubscriptions.push(sub);
          // Record subscription
          natsSubscribeCounter.inc({
            module: 'connector-irc',
            subject: `control.chatConnectors.irc.${client.name}`,
          });
        });

      // Subscribe to outgoing messages for this client
      void nats
        .subscribe(
          `chat.message.outgoing.irc.${client.name}.>`,
          (subject, ipcMessage) => {
            const outgoingMessage = JSON.parse(ipcMessage.string());
            // Extract channel from message payload
            const channel = outgoingMessage.channel || '#eevee';
            log.info('Outgoing message', {
              producer: 'ircClient',
              subject: subject,
              channel: channel,
              text: outgoingMessage.text,
            });
            client.say(channel, outgoingMessage.text);

            // Record outgoing message
            messageCounter.inc({
              module: 'connector-irc',
              direction: 'outgoing',
              result: 'sent',
            });
          }
        )
        .then((sub) => {
          if (sub && typeof sub === 'string') natsSubscriptions.push(sub);
          // Record subscription
          natsSubscribeCounter.inc({
            module: 'connector-irc',
            subject: `chat.message.outgoing.irc.${client.name}.>`,
          });
        });

      // Handle outgoing notice messages for this client
      void nats
        .subscribe(
          `chat.notice.outgoing.irc.${client.name}.>`,
          (subject, ipcMessage) => {
            const outgoingNotice = JSON.parse(ipcMessage.string());
            // Extract channel from message payload
            const channel = outgoingNotice.channel || '#eevee';
            log.info('Outgoing notice', {
              producer: 'ircClient',
              subject: subject,
              channel: channel,
              text: outgoingNotice.text,
            });
            client.notice(channel, outgoingNotice.text);

            // Record outgoing notice
            messageCounter.inc({
              module: 'connector-irc',
              direction: 'outgoing',
              result: 'sent',
            });
          }
        )
        .then((sub) => {
          if (sub && typeof sub === 'string') natsSubscriptions.push(sub);
          // Record subscription
          natsSubscribeCounter.inc({
            module: 'connector-irc',
            subject: `chat.notice.outgoing.irc.${client.name}.>`,
          });
        });

      // Subscribe to outgoing actions for this client
      void nats
        .subscribe(
          `chat.action.outgoing.irc.${client.name}.>`,
          (subject, ipcMessage) => {
            const outgoingAction = JSON.parse(ipcMessage.string());
            // Extract channel from message payload
            const channel = outgoingAction.channel || '#eevee';
            log.info('Outgoing action', {
              producer: 'ircClient',
              subject: subject,
              channel: channel,
              text: outgoingAction.text,
            });
            client.action(channel, outgoingAction.text);

            // Record outgoing action
            messageCounter.inc({
              module: 'connector-irc',
              direction: 'outgoing',
              result: 'sent',
            });
          }
        )
        .then((sub) => {
          if (sub && typeof sub === 'string') natsSubscriptions.push(sub);
          // Record subscription
          natsSubscribeCounter.inc({
            module: 'connector-irc',
            subject: `chat.action.outgoing.irc.${client.name}.>`,
          });
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

            // Record outgoing private notice
            messageCounter.inc({
              module: 'connector-irc',
              direction: 'outgoing',
              result: 'sent',
            });
          }
        )
        .then((sub) => {
          if (sub && typeof sub === 'string') natsSubscriptions.push(sub);
          // Record subscription
          natsSubscribeCounter.inc({
            module: 'connector-irc',
            subject: `chat.notice.outgoing.irc.${client.name}`,
          });
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
