declare module 'irc-framework' {
  import { EventEmitter } from 'events';

  export interface ClientOptions {
    host: string;
    port: number | string;
    nick: string;
    username?: string;
    gecos?: string;
    password?: string;
    account?: {
      account: string;
      password: string;
    };
    SASL?: string;
    ssl?: boolean | object;
    tlsOptions?: object;
    path?: string;
    encoding?: string;
    auto_reconnect?: boolean;
    auto_reconnect_wait?: number;
    auto_reconnect_max_retries?: number;
    auto_rejoin?: boolean;
    auto_rejoin_wait?: number;
    auto_rejoin_max_retries?: number;
    ping_interval?: number;
    ping_timeout?: number;
    version?: string;
    enable_chghost?: boolean;
    enable_echomessage?: boolean;
    message_max_length?: number;
    transport?: unknown;
    websocket_protocol?: string;
  }

  export interface MessageData {
    nick: string;
    hostname: string;
    target: string;
    message: string;
    tags: Record<string, string>;
    time: Date;
  }

  export interface JoinData {
    nick: string;
    channel: string;
    time?: Date;
  }

  export interface ConnectedData {
    nick: string;
    host?: string;
    port?: number;
    nicknames: string[];
  }

  export interface Channel {
    name: string;
    key: string;
    join(): void;
    say(message: string): void;
    part(): void;
  }

  export class Client extends EventEmitter {
    constructor(options?: ClientOptions);
    connect(options?: ClientOptions): void;
    disconnect(): void;
    join(channel: string, key?: string): Channel;
    channel(channel: string, key?: string): Channel;
    say(target: string, message: string): void;
    notice(target: string, message: string): void;
    quit(message?: string): void;

    // Event methods
    on(event: 'registered', listener: (data: unknown) => void): this;
    on(event: 'connected', listener: (data: ConnectedData) => void): this;
    on(event: 'reconnecting', listener: (data: unknown) => void): this;
    on(event: 'close', listener: (data: unknown) => void): this;
    on(event: 'socket close', listener: (data: unknown) => void): this;
    on(event: 'socket connected', listener: (data: unknown) => void): this;
    on(event: 'raw socket connected', listener: (data: unknown) => void): this;
    on(event: 'server options', listener: (data: unknown) => void): this;
    on(event: 'raw', listener: (data: unknown) => void): this;
    on(event: 'unknown command', listener: (data: unknown) => void): this;
    on(event: 'debug', listener: (data: unknown) => void): this;

    // Channel events
    on(event: 'channel info', listener: (data: unknown) => void): this;
    on(event: 'channel list start', listener: (data: unknown) => void): this;
    on(event: 'channel list', listener: (data: unknown) => void): this;
    on(event: 'channel list end', listener: (data: unknown) => void): this;
    on(event: 'wholist', listener: (data: unknown) => void): this;
    on(event: 'userlist', listener: (data: unknown) => void): this;
    on(event: 'invitelist', listener: (data: unknown) => void): this;
    on(event: 'banlist', listener: (data: unknown) => void): this;
    on(event: 'exceptlist', listener: (data: unknown) => void): this;
    on(event: 'topic', listener: (data: unknown) => void): this;
    on(event: 'topicsetby', listener: (data: unknown) => void): this;
    on(event: 'join', listener: (data: JoinData) => void): this;
    on(event: 'part', listener: (data: unknown) => void): this;
    on(event: 'kick', listener: (data: unknown) => void): this;
    on(event: 'quit', listener: (data: unknown) => void): this;
    on(event: 'invited', listener: (data: unknown) => void): this;

    // Message events
    on(event: 'notice', listener: (data: unknown) => void): this;
    on(event: 'action', listener: (data: unknown) => void): this;
    on(event: 'privmsg', listener: (data: unknown) => void): this;
    on(event: 'message', listener: (data: MessageData) => void): this;
    on(event: 'tagmsg', listener: (data: unknown) => void): this;
    on(event: 'ctcp response', listener: (data: unknown) => void): this;
    on(event: 'ctcp request', listener: (data: unknown) => void): this;
    on(event: 'wallops', listener: (data: unknown) => void): this;

    // User events
    on(event: 'nick', listener: (data: unknown) => void): this;
    on(event: 'account', listener: (data: unknown) => void): this;
    on(event: 'user info', listener: (data: unknown) => void): this;
    on(event: 'away', listener: (data: unknown) => void): this;
    on(event: 'back', listener: (data: unknown) => void): this;
    on(event: 'monitorlist', listener: (data: unknown) => void): this;
    on(event: 'nick in use', listener: (data: unknown) => void): this;
    on(event: 'nick invalid', listener: (data: unknown) => void): this;
    on(event: 'users online', listener: (data: unknown) => void): this;
    on(event: 'users offline', listener: (data: unknown) => void): this;
    on(event: 'whois', listener: (data: unknown) => void): this;
    on(event: 'whowas', listener: (data: unknown) => void): this;
    on(event: 'user updated', listener: (data: unknown) => void): this;

    // Misc events
    on(event: 'motd', listener: (data: unknown) => void): this;
    on(event: 'info', listener: (data: unknown) => void): this;
    on(event: 'help', listener: (data: unknown) => void): this;
    on(event: 'batch start', listener: (data: unknown) => void): this;
    on(event: 'batch end', listener: (data: unknown) => void): this;
    on(event: 'cap ls', listener: (data: unknown) => void): this;
    on(event: 'cap ack', listener: (data: unknown) => void): this;
    on(event: 'cap nak', listener: (data: unknown) => void): this;
    on(event: 'cap list', listener: (data: unknown) => void): this;
    on(event: 'cap new', listener: (data: unknown) => void): this;
    on(event: 'cap del', listener: (data: unknown) => void): this;

    // SASL events
    on(event: 'loggedin', listener: (data: unknown) => void): this;
    on(event: 'loggedout', listener: (data: unknown) => void): this;
    on(event: 'sasl failed', listener: (data: unknown) => void): this;
  }

  export default Client;
}
