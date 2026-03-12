import { EventEmitter } from 'events';
import * as crypto from 'crypto';

import * as IRC from 'irc-framework';

import { log } from '@eeveebot/libeevee';

interface IrcClientConfig {
  name: string;
  ident: IdentConfig;
  connection: unknown;
  postConnect: PostConnectAction[];
  connectionOptions: ConnectionOptions;
}

interface ConnectionOptions {
  auto_reconnect_max_retries: number | string;
  auto_reconnect_wait: number | string;
  auto_reconnect: boolean | string;
  auto_rejoin_max_retries: number | string;
  auto_rejoin_wait: number | string;
  auto_rejoin: boolean | string;
  gecos: string;
  host: string;
  nick: string;
  ping_interval: number | string;
  ping_timeout: number | string;
  port: number | string;
  ssl: boolean | string;
  username: string;
  version: string;
}

interface PostConnectAction {
  action: string;
  join?: {
    channel: string;
    key?: string;
  }[];
}

interface IdentConfig {
  quitMsg: string;
  gecos?: string;
  nick?: string;
  username?: string;
  version?: string;
}

interface Status {
  remoteHost: string;
  channels: string[];
  [key: string]: unknown;
}

export class IrcClient extends EventEmitter {
  name: string = '';
  instanceUUID: string = '';
  instanceIdent: string = '';
  ident: IdentConfig;
  postConnect: PostConnectAction[];

  status: Status = {
    remoteHost: '',
    channels: [],
  };

  connectionOptions: ConnectionOptions;

  channels: IRC.Channel[] = [];

  irc: IRC.Client;

  constructor(config: IrcClientConfig) {
    super();
    this.name = config.name;
    this.ident = config.ident;
    this.postConnect = config.postConnect;
    this.connectionOptions = config.connectionOptions;
    this.instanceIdent = `${process.env.HOSTNAME}-${config.name}`;
    this.instanceUUID = crypto.randomUUID();
    this.channels = [];
    this.irc = new IRC.Client();

    this.irc.on('connected', (data: IRC.ConnectedData) => {
      log.info(
        `client connected to ${this.connectionOptions.host} as ${data.nick}`,
        {
          producer: 'ircClient',
          instanceUUID: this.instanceUUID,
          rawEvent: data,
        }
      );
      this.updateStatus('ircConnected', true);
      this.updateStatus('remoteHost', this.connectionOptions.host);
      this.updateStatus('currentNick', data.nick);
      if (this.postConnect) {
        setTimeout(() => {
          this.postConnect.forEach((action) => {
            if (action.action === 'join' && action.join) {
              log.info(`found ${action.join.length} channels to join`, {
                producer: 'ircClient',
                instanceUUID: this.instanceUUID,
              });
              action.join.forEach((channel) => {
                this.join({ name: channel.channel, key: channel.key || '' });
              });
            }
          });
        }, 2500);
      }
    });

    // When we join a channel, update our list of channels
    this.irc.on('join', (data: IRC.JoinData) => {
      log.info(`joined channel ${data.channel}`, {
        producer: 'ircClient',
        instanceUUID: this.instanceUUID,
        rawEvent: data,
      });
      this.updateStatus('channels', this.status.channels.concat(data.channel));
    });

    // Passthrough all events
    this.irc.on('registered', (...args: unknown[]) => {
      this.emit('registered', ...args);
    });

    this.irc.on('connected', (...args: unknown[]) => {
      this.emit('connected', ...args);
    });

    this.irc.on('reconnecting', (...args: unknown[]) => {
      this.emit('reconnecting', ...args);
    });

    this.irc.on('close', (...args: unknown[]) => {
      this.emit('close', ...args);
    });

    this.irc.on('socket close', (...args: unknown[]) => {
      this.emit('socket close', ...args);
    });

    this.irc.on('socket connected', (...args: unknown[]) => {
      this.emit('socket connected', ...args);
    });

    this.irc.on('raw socket connected', (...args: unknown[]) => {
      this.emit('raw socket connected', ...args);
    });

    this.irc.on('server options', (...args: unknown[]) => {
      this.emit('server options', ...args);
    });

    this.irc.on('raw', (...args: unknown[]) => {
      this.emit('raw', ...args);
    });

    this.irc.on('unknown command', (...args: unknown[]) => {
      this.emit('unknown command', ...args);
    });

    this.irc.on('debug', (...args: unknown[]) => {
      this.emit('debug', ...args);
    });

    // Channels
    this.irc.on('channel info', (...args: unknown[]) => {
      this.emit('channel info', ...args);
    });

    this.irc.on('channel list start', (...args: unknown[]) => {
      this.emit('channel list start', ...args);
    });

    this.irc.on('channel list', (...args: unknown[]) => {
      this.emit('channel list', ...args);
    });

    this.irc.on('channel list end', (...args: unknown[]) => {
      this.emit('channel list end', ...args);
    });

    this.irc.on('wholist', (...args: unknown[]) => {
      this.emit('wholist', ...args);
    });

    this.irc.on('userlist', (...args: unknown[]) => {
      this.emit('userlist', ...args);
    });

    this.irc.on('invitelist', (...args: unknown[]) => {
      this.emit('invitelist', ...args);
    });

    this.irc.on('banlist', (...args: unknown[]) => {
      this.emit('banlist', ...args);
    });

    this.irc.on('exceptlist', (...args: unknown[]) => {
      this.emit('exceptlist', ...args);
    });

    this.irc.on('topic', (...args: unknown[]) => {
      this.emit('topic', ...args);
    });

    this.irc.on('topicsetby', (...args: unknown[]) => {
      this.emit('topicsetby', ...args);
    });

    this.irc.on('join', (...args: unknown[]) => {
      this.emit('join', ...args);
    });

    this.irc.on('part', (...args: unknown[]) => {
      this.emit('part', ...args);
    });

    this.irc.on('kick', (...args: unknown[]) => {
      this.emit('kick', ...args);
    });

    this.irc.on('quit', (...args: unknown[]) => {
      this.emit('quit', ...args);
    });

    this.irc.on('invited', (...args: unknown[]) => {
      this.emit('invited', ...args);
    });

    // Messaging
    this.irc.on('notice', (...args: unknown[]) => {
      this.emit('notice', ...args);
    });

    this.irc.on('action', (...args: unknown[]) => {
      this.emit('action', ...args);
    });

    this.irc.on('privmsg', (...args: unknown[]) => {
      this.emit('privmsg', ...args);
    });

    this.irc.on('message', (...args: unknown[]) => {
      this.emit('message', ...args);
    });

    this.irc.on('tagmsg', (...args: unknown[]) => {
      this.emit('tagmsg', ...args);
    });

    this.irc.on('ctcp response', (...args: unknown[]) => {
      this.emit('ctcp response', ...args);
    });

    this.irc.on('ctcp request', (...args: unknown[]) => {
      this.emit('ctcp request', ...args);
    });

    this.irc.on('wallops', (...args: unknown[]) => {
      this.emit('wallops', ...args);
    });

    // Users
    this.irc.on('nick', (...args: unknown[]) => {
      this.emit('nick', ...args);
    });

    this.irc.on('account', (...args: unknown[]) => {
      this.emit('account', ...args);
    });

    this.irc.on('user info', (...args: unknown[]) => {
      this.emit('user info', ...args);
    });

    this.irc.on('away', (...args: unknown[]) => {
      this.emit('away', ...args);
    });

    this.irc.on('back', (...args: unknown[]) => {
      this.emit('back', ...args);
    });

    this.irc.on('monitorlist', (...args: unknown[]) => {
      this.emit('monitorlist', ...args);
    });

    this.irc.on('nick in use', (...args: unknown[]) => {
      this.emit('nick in use', ...args);
    });

    this.irc.on('nick invalid', (...args: unknown[]) => {
      this.emit('nick invalid', ...args);
    });

    this.irc.on('users online', (...args: unknown[]) => {
      this.emit('users online', ...args);
    });

    this.irc.on('users offline', (...args: unknown[]) => {
      this.emit('users offline', ...args);
    });

    this.irc.on('whois', (...args: unknown[]) => {
      this.emit('whois', ...args);
    });

    this.irc.on('whowas', (...args: unknown[]) => {
      this.emit('whowas', ...args);
    });

    this.irc.on('user updated', (...args: unknown[]) => {
      this.emit('user updated', ...args);
    });

    // Misc
    this.irc.on('motd', (...args: unknown[]) => {
      this.emit('motd', ...args);
    });

    this.irc.on('info', (...args: unknown[]) => {
      this.emit('info', ...args);
    });

    this.irc.on('help', (...args: unknown[]) => {
      this.emit('help', ...args);
    });

    this.irc.on('batch start', (...args: unknown[]) => {
      this.emit('batch start', ...args);
    });

    this.irc.on('batch end', (...args: unknown[]) => {
      this.emit('batch end', ...args);
    });

    this.irc.on('cap ls', (...args: unknown[]) => {
      this.emit('cap ls', ...args);
    });

    this.irc.on('cap ack', (...args: unknown[]) => {
      this.emit('cap ack', ...args);
    });

    this.irc.on('cap nak', (...args: unknown[]) => {
      this.emit('cap nak', ...args);
    });

    this.irc.on('cap list', (...args: unknown[]) => {
      this.emit('cap list', ...args);
    });

    this.irc.on('cap new', (...args: unknown[]) => {
      this.emit('cap new', ...args);
    });

    this.irc.on('cap del', (...args: unknown[]) => {
      this.emit('cap del', ...args);
    });

    // SASL
    this.irc.on('loggedin', (...args: unknown[]) => {
      this.emit('loggedin', ...args);
    });

    this.irc.on('loggedout', (...args: unknown[]) => {
      this.emit('loggedout', ...args);
    });

    this.irc.on('sasl failed', (...args: unknown[]) => {
      this.emit('sasl failed', ...args);
    });
  }

  // join joins the bot to a channel
  join(channel: { name: string; key?: string }) {
    log.info(`joining channel ${channel.name}`, {
      producer: 'ircClient',
      instanceUUID: this.instanceUUID,
    });
    const obj = this.irc.channel(channel.name, channel.key || '');
    // Push the channel+key to the array for later use
    this.channels.push(obj);
    obj.join();
    return obj;
  }

  // connect() connects the IrcClient to the configured server
  connect() {
    log.info(`client connecting to ${this.connectionOptions.host}`, {
      producer: 'ircClient',
      instanceUUID: this.instanceUUID,
    });

    // Map our ConnectionOptions to IRC ClientOptions
    const ircOptions: IRC.ClientOptions = {
      host: this.connectionOptions.host,
      port: this.connectionOptions.port,
      nick: this.connectionOptions.nick,
      username: this.connectionOptions.username,
      gecos: this.connectionOptions.gecos,
      ssl:
        typeof this.connectionOptions.ssl === 'boolean'
          ? this.connectionOptions.ssl
          : this.connectionOptions.ssl === 'true',
      auto_reconnect:
        typeof this.connectionOptions.auto_reconnect === 'boolean'
          ? this.connectionOptions.auto_reconnect
          : this.connectionOptions.auto_reconnect === 'true',
      auto_reconnect_wait:
        typeof this.connectionOptions.auto_reconnect_wait === 'number'
          ? this.connectionOptions.auto_reconnect_wait
          : parseInt(this.connectionOptions.auto_reconnect_wait as string, 10),
      auto_reconnect_max_retries:
        typeof this.connectionOptions.auto_reconnect_max_retries === 'number'
          ? this.connectionOptions.auto_reconnect_max_retries
          : parseInt(
              this.connectionOptions.auto_reconnect_max_retries as string,
              10
            ),
      auto_rejoin:
        typeof this.connectionOptions.auto_rejoin === 'boolean'
          ? this.connectionOptions.auto_rejoin
          : this.connectionOptions.auto_rejoin === 'true',
      auto_rejoin_wait:
        typeof this.connectionOptions.auto_rejoin_wait === 'number'
          ? this.connectionOptions.auto_rejoin_wait
          : parseInt(this.connectionOptions.auto_rejoin_wait as string, 10),
      auto_rejoin_max_retries:
        typeof this.connectionOptions.auto_rejoin_max_retries === 'number'
          ? this.connectionOptions.auto_rejoin_max_retries
          : parseInt(
              this.connectionOptions.auto_rejoin_max_retries as string,
              10
            ),
      ping_interval:
        typeof this.connectionOptions.ping_interval === 'number'
          ? this.connectionOptions.ping_interval
          : parseInt(this.connectionOptions.ping_interval as string, 10),
      ping_timeout:
        typeof this.connectionOptions.ping_timeout === 'number'
          ? this.connectionOptions.ping_timeout
          : parseInt(this.connectionOptions.ping_timeout as string, 10),
      version: this.connectionOptions.version,
    };

    this.irc.connect(ircOptions);
  }

  quit(msg?: string) {
    this.irc.quit(msg || this.ident.quitMsg);
  }

  updateStatus(field: string, value: unknown) {
    this.status[field] = value;
  }

  say(target: string, message: string) {
    this.irc.say(target, message);
  }
}
