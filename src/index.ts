// initOtel must run BEFORE Fastify is loaded so auto-instrumentation can hook
// it at module-load time. Static imports are hoisted; we keep only the OTel
// helper imported statically here and dynamically import everything else.
import { initOtel } from '@urule/observability';

const otelSdk = initOtel('channel-router');

const { buildServer } = await import('./server.js');
const { loadConfig, validateConfig } = await import('./config.js');

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

const shutdown = async () => {
  console.log('Shutting down...');
  await server.close();
  if (otelSdk) await otelSdk.shutdown();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
