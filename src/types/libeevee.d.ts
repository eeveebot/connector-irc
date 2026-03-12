declare module '@eeveebot/libeevee' {
  import { EventEmitter } from 'events';
  import { Msg } from 'nats';

  export const eeveeLogo: string;

  export interface LogMetadata {
    producer: string;
    [key: string]: unknown;
  }

  export const log: {
    info(message: string, metadata?: LogMetadata): void;
    error(message: string, metadata?: LogMetadata): void;
    warn(message: string, metadata?: LogMetadata): void;
    debug(message: string, metadata?: LogMetadata): void;
  };

  export interface NatsClientConfig {
    natsHost: string;
    natsToken: string;
  }

  export class NatsClient extends EventEmitter {
    constructor(config: NatsClientConfig);
    connect(): Promise<void>;
    subscribe(
      subject: string,
      callback: (subject: string, message: Msg) => void
    ): Promise<string | false>;
    publish(subject: string, message: string): Promise<boolean>;
    drain(): Promise<void>;
  }

  export function handleSIG(signal: string): void;
}
