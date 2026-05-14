# connector-irc

> IRC network connector for the eevee framework.

## Overview

**connector-irc** bridges the eevee framework to IRC networks. It manages one or more IRC connections defined in a YAML configuration file, translates incoming IRC events (messages, actions, notices) into NATS messages for the router, and relays outgoing NATS messages back to IRC channels and users.

The connector is designed as a standalone service that communicates entirely through NATS — no direct API calls between modules. Each IRC connection is identified by a unique name, and all NATS subjects include that name so downstream consumers can route messages to the correct instance.

Configuration is file-driven and **hot-reloaded**: when the YAML config file changes on disk, connector-irc disconnects all existing clients and reconnects using the new settings, with no restart required.

## Features

- **Multiple connections** — connect to any number of IRC networks simultaneously from a single process
- **Hot config reload** — watches the config file and reconnects automatically on changes
- **Bidirectional messaging** — publishes incoming IRC messages to NATS and subscribes to outgoing NATS subjects
- **Message types** — supports privmsg, action (`/me`), and notice messages in both directions
- **Post-connect actions** — auto-join channels after connecting
- **Control channel** — runtime join, part, kick, and user-list queries via NATS control messages
- **Auto-reconnect & auto-rejoin** — configurable retry behavior for network drops and channel kicks
- **Prometheus metrics** — message counters, connection gauges, channel gauges, error counters exposed via HTTP
- **Uptime & stats** — responds to `stats.uptime` and `stats.emit.request` NATS subjects

## Install

This module is part of the eevee ecosystem and is not published independently. Install from source:

```bash
cd connector-irc
npm install
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MODULE_CONFIG_PATH` | Yes | Absolute path to the YAML configuration file |
| `NATS_HOST` | Yes | Hostname of the NATS server |
| `NATS_TOKEN` | Yes | Authentication token for NATS |
| `HTTP_API_PORT` | No | Port for the Prometheus metrics HTTP server (default: `9000`) |

### Configuration File Format

The YAML file defines a list of connections, each with its own IRC server settings, identity, and post-connect actions:

```yaml
connections:
- name: liberachat
  irc:
    host: irc.libera.chat
    port: 6697
    ssl: true
    autoReconnect: true
    autoReconnectMaxRetries: 10
    autoReconnectWait: 5000
    autoRejoin: true
    autoRejoinMaxRetries: 5
    autoRejoinWait: 5000
    pingInterval: 30
    pingTimeout: 120
  ident:
    nick: mybot
    username: mybot
    gecos: My eevee Bot
    quitMsg: Goodbye!
    version: 1.0.0
  postConnect:
  - action: join
    join:
    - channel: '#eevee'
    - channel: '#ops'
      key: secretkey
  commands:
    commonPrefixRegex: '^[!]'
```

### IRC Settings (`irc`)

| Key | Type | Default | Description |
|---|---|---|---|
| `host` | string | `localhost` | IRC server hostname |
| `port` | number/string | `6667` | IRC server port |
| `ssl` | boolean | `false` | Enable TLS |
| `autoReconnect` | boolean | `true` | Reconnect on disconnect |
| `autoReconnectMaxRetries` | number | `10` | Max reconnect attempts |
| `autoReconnectWait` | number | `5000` | Milliseconds between retries |
| `autoRejoin` | boolean | `true` | Rejoin channels after kick |
| `autoRejoinMaxRetries` | number | `5` | Max rejoin attempts |
| `autoRejoinWait` | number | `5000` | Milliseconds between rejoin retries |
| `pingInterval` | number | `30` | Seconds between keepalive pings |
| `pingTimeout` | number | `120` | Seconds before ping timeout |

### Identity Settings (`ident`)

| Key | Type | Default | Description |
|---|---|---|---|
| `nick` | string | `eevee` | Bot nickname |
| `username` | string | `eevee` | IRC username/ident |
| `gecos` | string | `eevee.bot` | Real name (GECOS) field |
| `quitMsg` | string | — | Quit message (required) |
| `version` | string | connector version | CTCP VERSION response |

### Post-Connect Actions (`postConnect`)

Each entry has an `action` field. Currently only `join` is supported:

```yaml
postConnect:
- action: join
  join:
  - channel: '#general'
  - channel: '#private'
    key: channelkey
```

### Command Settings (`commands`)

| Key | Type | Description |
|---|---|---|
| `commonPrefixRegex` | string | Regex pattern for command prefixes, included in outgoing message metadata |

## Usage / Commands

### NATS Subject Patterns

connector-irc uses structured NATS subjects to route messages. The `{name}` placeholder refers to the connection name from the config.

**Incoming messages** (IRC → NATS):

| Subject | Description |
|---|---|
| `chat.message.incoming.irc.{name}.{channel}.{nick}` | Incoming privmsg or action from IRC |

**Outgoing messages** (NATS → IRC):

| Subject | Payload | Description |
|---|---|---|
| `chat.message.outgoing.irc.{name}.>` | `{ channel, text }` | Send a message to a channel/user |
| `chat.action.outgoing.irc.{name}.>` | `{ channel, text }` | Send a `/me` action |
| `chat.notice.outgoing.irc.{name}.>` | `{ channel, text }` | Send a notice to a channel |
| `chat.notice.outgoing.irc.{name}` | `{ target, text }` | Send a private notice to a user |

### Control Channel

Send JSON messages to `control.chatConnectors.irc.{name}` to control the bot at runtime:

**Join a channel:**
```json
{
  "action": "join",
  "data": { "channel": "#newchannel", "key": "optionalkey" }
}
```

**Part a channel:**
```json
{
  "action": "part",
  "data": { "channel": "#oldchannel" }
}
```

**Kick a user:**
```json
{
  "action": "kick",
  "data": { "channel": "#channel", "nick": "troublemaker", "reason": "optional reason" }
}
```

**List users in a channel:**
```json
{
  "action": "list-users-in-channel",
  "data": { "channel": "#channel", "replyChannel": "ephemeral.reply.subject" }
}
```

The user list response is published to the `replyChannel`:
```json
{
  "channel": "#channel",
  "users": [
    { "nick": "alice", "ident": "alice", "hostname": "user/host", "modes": ["o"], "isChannelAdmin": true }
  ],
  "count": 1
}
```

Each user object includes an `isChannelAdmin` boolean — `true` if the user has channel mode `+h` (halfop), `+o` (op), `+a` (admin/protect), or `+q` (owner).

If the NAMES response times out (10 seconds), an error response is sent:
```json
{
  "channel": "#channel",
  "error": "Timeout waiting for user list",
  "users": []
}
```

**Get modes for a user:**
```json
{
  "action": "get-modes-for-user",
  "data": { "channel": "#channel", "nick": "someuser", "replyChannel": "ephemeral.reply.subject" }
}
```

The modes response is published to the `replyChannel`:
```json
{
  "channel": "#channel",
  "nick": "someuser",
  "modes": ["o", "v"],
  "isChannelAdmin": true
}
```

If the user is not found in the channel:
```json
{
  "channel": "#channel",
  "nick": "someuser",
  "modes": [],
  "isChannelAdmin": false,
  "warning": "User not found in channel"
}
```

If the WHO query times out (5 seconds):
```json
{
  "channel": "#channel",
  "nick": "someuser",
  "modes": [],
  "isChannelAdmin": false,
  "error": "Timeout waiting for user modes"
}
```

This action sends a WHO query to the IRC server every time (no caching) to ensure fresh, authoritative mode data.

### Stats Subjects

| Subject | Description |
|---|---|
| `stats.uptime` | Responds with module uptime via `replyChannel` |
| `stats.emit.request` | Responds with full stats (uptime, memory, Prometheus metrics) via `replyChannel` |
| `control.connectors.irc.core.>` | Logs core control messages |

### Incoming Message Format

Messages published to NATS from incoming IRC events include:

```json
{
  "type": "chat.message.incoming",
  "platform": "irc",
  "instance": "liberachat",
  "network": "irc.libera.chat",
  "channel": "#eevee",
  "nick": "someuser",
  "user": "someident",
  "userHost": "user@host",
  "text": "!weather NYC",
  "time": "2026-05-07T20:00:00.000Z",
  "account": "someaccount",
  "botNick": "mybot",
  "commonPrefixRegex": "^[!]",
  "action": false
}
```

The `action` field is `true` for `/me` messages, omitted or `false` for regular privmsgs.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   connector-irc                      │
│                                                      │
│  ┌──────────────┐    ┌──────────────┐               │
│  │  IrcClient   │    │  IrcClient   │  ...          │
│  │  (liberachat)│    │  (oftc)      │               │
│  └──────┬───────┘    └──────┬───────┘               │
│         │                   │                        │
│    privmsg/action      privmsg/action                │
│    events              events                       │
│         │                   │                        │
│         ▼                   ▼                        │
│  ┌─────────────────────────────────┐                │
│  │          main.mts               │                │
│  │  ┌────────────┐ ┌────────────┐  │                │
│  │  │  chokidar  │ │  express   │  │                │
│  │  │  (config   │ │  (metrics  │  │                │
│  │  │   reload)  │ │   HTTP)    │  │                │
│  │  └────────────┘ └────────────┘  │                │
│  └──────────────┬──────────────────┘                │
│                 │                                    │
└─────────────────┼────────────────────────────────────┘
                  │ NATS
                  ▼
         ┌──────────────┐
         │    router     │  →  command modules
         └──────────────┘
```

**Key components:**

- **`main.mts`** — Entry point. Sets up NATS, reads config, creates `IrcClient` instances, wires event handlers, subscribes to outgoing and control NATS subjects, watches the config file for changes.
- **`IrcClient`** — Wraps `irc-framework`'s `Client` with eevee-specific concerns: status tracking, channel management, prometheus metrics, and EventEmitter passthrough of all IRC events.
- **`metrics/`** — Re-exports Prometheus counters and gauges from `@eeveebot/libeevee` plus the `prom-client` register for full metrics collection.

**Message flow:**

1. IRC server sends a privmsg → `irc-framework` emits `privmsg` event
2. `IrcClient` re-emits the event (passthrough)
3. `main.mts` handler constructs a structured message and publishes to `chat.message.incoming.irc.{name}.{channel}.{nick}` on NATS
4. The eevee router picks up the message and dispatches to command modules
5. A command module publishes a response to `chat.message.outgoing.irc.{name}.>`
6. `main.mts` handler calls `client.say(channel, text)` to deliver the message on IRC

**Config hot-reload:**

`chokidar` watches the config file. On `add` (initial load) or `change`, the NATS client is drained (with a 3-second per-client timeout), all existing IRC clients quit, the config file is re-read, and new clients are created and connected. The NATS client is then recreated so subscriptions are fresh. This ensures no stale subscriptions or messages are lost during the transition.

## Development

```bash
# Clone the repo and navigate to the connector
cd connector-irc

# Install dependencies
npm install

# Lint
npm test

# Build (lint + TypeScript compile)
npm run build

# Run locally (build + start)
npm run dev

# Update libeevee to latest
npm run update-libraries
```

The module requires Node.js ≥ 24.0.0.

### Running Locally

You need a running NATS server and a valid config file:

```bash
export NATS_HOST=nats.example.com
export NATS_TOKEN=your-token
export MODULE_CONFIG_PATH=/path/to/config.yaml
npm run dev
```

## Contributing

This module is part of the [eevee.bot](https://github.com/eeveebot/eevee) project. See the repository for contribution guidelines.

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — see [LICENSE](./LICENSE) for the full text.
