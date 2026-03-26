import { buildServer } from './server.js';
import { loadConfig, validateConfig } from './config.js';

const config = loadConfig();
validateConfig(config);
const server = await buildServer({ logger: true });

server.listen({ port: config.port, host: config.host }, (err, address) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log(`urule-channel-router listening at ${address}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down...');
  await server.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
