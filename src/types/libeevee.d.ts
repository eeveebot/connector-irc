declare module '@eeveebot/libeevee' {
  import { EventEmitter } from 'events';
  import { Msg } from 'nats';
  import { Logger } from 'winston';
  import { Subscription } from 'nats';
  import { Codec } from 'nats';
  import { NatsConnection } from 'nats';

  export const eeveeLogo: string;

  export const log: Logger;

  export interface NatsClientConfig {
    natsHost: string;
    natsToken: string;
  }

  export class NatsClient extends EventEmitter {
    name: string;
    instanceUUID: string;
    instanceIdent: string;
    subjects: Subscription[];
    natsHost: string | null;
    natsToken: string | null;
    sc: Codec<string>;
    nats: NatsConnection | null;

    constructor(config: NatsClientConfig);
    connect(): Promise<void>;
    subscribe(
      subject: string,
      callback?: (subject: string, message: Msg) => void
    ): Promise<string | boolean>;
    publish(subject: string, message: Uint8Array | string): Promise<boolean>;
    drain(): Promise<void>;
  }

  export function handleSIG(signal: NodeJS.Signals): Promise<void>;
}
