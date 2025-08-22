'use strict';

import { log as log } from './log.mjs';

export async function handleSIG(signal) {
  log.info(`[handleSIG] Received ${signal}, cleaning up... (repeat to force)`);
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGINT');
  process.on(signal, () => {
    throw new Error(`[handleSIG] Received ${signal} twice, forcing exit.`);
  });
  setTimeout(() => {
    throw new Error('[handleSIG] Timeout expired, forcing exit.');
  }, 5000).unref();
}
