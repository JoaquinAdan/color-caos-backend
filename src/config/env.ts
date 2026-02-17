import 'dotenv/config'

// Centraliza acceso a variables de entorno y valores por defecto.
// Aquí luego se pueden validar variables requeridas (JWT, Redis, CORS, etc.).
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL ?? '',
  upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
}

export type EnvConfig = typeof env