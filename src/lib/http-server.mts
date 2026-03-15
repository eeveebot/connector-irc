import express, { Application, Request, Response } from 'express';
import { log } from '@eeveebot/libeevee';
import { register } from 'prom-client';

/**
 * Setup HTTP API server for metrics exposure
 */
export function setupHttpServer(): void {
  const app: Application = express();
  const port = process.env.HTTP_API_PORT || '9001';

  // Metrics endpoint
  app.get('/metrics', async (req: Request, res: Response) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (ex) {
      res.status(500).end(ex);
    }
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'connector-irc',
    });
  });

  // Root endpoint
  app.get('/', (req: Request, res: Response) => {
    res.status(200).json({
      message: 'eevee.bot IRC Connector API',
      timestamp: new Date().toISOString(),
    });
  });

  // Start server
  const server = app.listen(port, () => {
    log.info(`HTTP API server listening on port ${port}`);
  });

  // Handle server errors
  server.on('error', (err: Error) => {
    log.error('HTTP API server error', err);
  });
}