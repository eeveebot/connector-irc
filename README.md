# connector-irc

Connector to IRC networks for the eevee.bot framework.

## Configuration

This connector uses the standard botModule configuration approach. All IRC-specific settings should be placed in the `moduleConfig` field of a botModule resource with `moduleName: 'irc'`.

### Environment Variables

- `MODULE_CONFIG_PATH` - Path to the YAML configuration file (required)
- `NATS_HOST` - NATS server hostname (required)
- `NATS_TOKEN` - NATS authentication token (required)

### Configuration File Format

The configuration file should be a YAML file with the following structure:

```yaml
connections:
- name: my-irc-network
  irc:
    host: irc.example.com
    port: 6667
    ssl: true
    # ... other IRC settings
  ident:
    nick: mybot
    username: mybot
    gecos: My Bot
    # ... other ident settings
  postConnect:
  - action: join
    join:
    - channel: '#mychannel'
```
