import { register } from 'prom-client';
import { 
  messageCounter,
  messageProcessingTime,
  connectionCounter,
  connectionGauge,
  channelCounter,
  channelGauge,
  natsPublishCounter,
  natsSubscribeCounter,
  errorCounter,
  initializeSystemMetrics
} from '@eeveebot/libeevee';

// Export common metrics from libeevee
export { 
  messageCounter,
  messageProcessingTime,
  connectionCounter,
  connectionGauge,
  channelCounter,
  channelGauge,
  natsPublishCounter,
  natsSubscribeCounter,
  errorCounter,
  initializeSystemMetrics
};

// Export register for metrics collection
export { register };