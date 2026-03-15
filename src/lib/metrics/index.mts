import { Counter, Gauge, Histogram, register } from 'prom-client';

// Message processing metrics
export const messageCounter = new Counter({
  name: 'connector_irc_messages_total',
  help: 'Total number of messages processed by the IRC connector',
  labelNames: ['network', 'channel', 'direction', 'result'],
});

export const messageProcessingTime = new Histogram({
  name: 'connector_irc_message_processing_seconds',
  help: 'Time spent processing messages',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

// Connection metrics
export const connectionCounter = new Counter({
  name: 'connector_irc_connections_total',
  help: 'Total number of IRC connections attempts',
  labelNames: ['network', 'result'],
});

export const connectionGauge = new Gauge({
  name: 'connector_irc_active_connections',
  help: 'Number of active IRC connections',
  labelNames: ['network'],
});

// Channel metrics
export const channelCounter = new Counter({
  name: 'connector_irc_channels_total',
  help: 'Total number of channel join/part events',
  labelNames: ['network', 'channel', 'action'],
});

export const channelGauge = new Gauge({
  name: 'connector_irc_active_channels',
  help: 'Number of active channels per network',
  labelNames: ['network', 'channel'],
});

// NATS metrics
export const natsPublishCounter = new Counter({
  name: 'connector_irc_nats_publish_total',
  help: 'Total number of NATS messages published',
  labelNames: ['type'],
});

export const natsSubscribeCounter = new Counter({
  name: 'connector_irc_nats_subscribe_total',
  help: 'Total number of NATS subscriptions',
  labelNames: ['subject'],
});

// Error metrics
export const errorCounter = new Counter({
  name: 'connector_irc_errors_total',
  help: 'Total number of errors encountered',
  labelNames: ['type', 'operation'],
});

// System metrics
export const uptimeGauge = new Gauge({
  name: 'connector_irc_uptime_seconds',
  help: 'IRC connector uptime in seconds',
});

export const memoryUsageGauge = new Gauge({
  name: 'connector_irc_memory_usage_bytes',
  help: 'IRC connector memory usage in bytes',
  labelNames: ['type'],
});

// Export register for metrics collection
export { register };

// Initialize system metrics
export function initializeSystemMetrics(): void {
  // Update uptime gauge periodically
  setInterval(() => {
    uptimeGauge.set(process.uptime());
  }, 10000); // Update every 10 seconds

  // Update memory usage periodically
  setInterval(() => {
    const memoryUsage = process.memoryUsage();
    memoryUsageGauge.set({ type: 'heap_used' }, memoryUsage.heapUsed);
    memoryUsageGauge.set({ type: 'heap_total' }, memoryUsage.heapTotal);
    memoryUsageGauge.set({ type: 'rss' }, memoryUsage.rss);
    memoryUsageGauge.set({ type: 'external' }, memoryUsage.external);
  }, 10000); // Update every 10 seconds
}