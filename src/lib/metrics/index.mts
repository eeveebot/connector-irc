import { Counter, Gauge, Histogram, register } from 'prom-client';

// Message processing metrics
export const messageCounter = new Counter({
  name: 'messages_total',
  help: 'Total number of messages processed',
  labelNames: ['module', 'network', 'channel', 'direction', 'result'],
});

export const messageProcessingTime = new Histogram({
  name: 'message_processing_seconds',
  help: 'Time spent processing messages',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

// Connection metrics
export const connectionCounter = new Counter({
  name: 'connections_total',
  help: 'Total number of connection attempts',
  labelNames: ['module', 'network', 'result'],
});

export const connectionGauge = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  labelNames: ['module', 'network'],
});

// Channel metrics
export const channelCounter = new Counter({
  name: 'channels_total',
  help: 'Total number of channel join/part events',
  labelNames: ['module', 'network', 'channel', 'action'],
});

export const channelGauge = new Gauge({
  name: 'active_channels',
  help: 'Number of active channels',
  labelNames: ['module', 'network', 'channel'],
});

// NATS metrics
export const natsPublishCounter = new Counter({
  name: 'nats_publish_total',
  help: 'Total number of NATS messages published',
  labelNames: ['module', 'type'],
});

export const natsSubscribeCounter = new Counter({
  name: 'nats_subscribe_total',
  help: 'Total number of NATS subscriptions',
  labelNames: ['module', 'subject'],
});

// Error metrics
export const errorCounter = new Counter({
  name: 'errors_total',
  help: 'Total number of errors encountered',
  labelNames: ['module', 'type', 'operation'],
});

// System metrics
export const uptimeGauge = new Gauge({
  name: 'uptime_seconds',
  help: 'Service uptime in seconds',
  labelNames: ['module'],
});

export const memoryUsageGauge = new Gauge({
  name: 'memory_usage_bytes',
  help: 'Service memory usage in bytes',
  labelNames: ['module', 'type'],
});

// Export register for metrics collection
export { register };

// Initialize system metrics
export function initializeSystemMetrics(): void {
  // Update uptime gauge periodically
  setInterval(() => {
    uptimeGauge.set({ module: 'connector-irc' }, process.uptime());
  }, 10000); // Update every 10 seconds

  // Update memory usage periodically
  setInterval(() => {
    const memoryUsage = process.memoryUsage();
    memoryUsageGauge.set({ module: 'connector-irc', type: 'heap_used' }, memoryUsage.heapUsed);
    memoryUsageGauge.set({ module: 'connector-irc', type: 'heap_total' }, memoryUsage.heapTotal);
    memoryUsageGauge.set({ module: 'connector-irc', type: 'rss' }, memoryUsage.rss);
    memoryUsageGauge.set({ module: 'connector-irc', type: 'external' }, memoryUsage.external);
  }, 10000); // Update every 10 seconds
}