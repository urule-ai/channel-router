export interface Config {
  port: number;
  host: string;
  natsUrl: string;
  registryUrl: string;
}

export function loadConfig(): Config {
  return {
    port: parseInt(process.env.PORT ?? '3006', 10),
    host: process.env.HOST ?? '0.0.0.0',
    natsUrl: process.env.NATS_URL ?? 'nats://localhost:4222',
    registryUrl: process.env.REGISTRY_URL ?? 'http://localhost:3001',
  };
}

export function validateConfig(_config: Config): void {
  const missing: string[] = [];
  if (!process.env.NATS_URL) missing.push('NATS_URL');
  if (missing.length > 0) {
    throw new Error(`[urule-channel-router] Missing required env vars: ${missing.join(', ')}`);
  }
}
