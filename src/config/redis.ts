import { Redis } from '@upstash/redis'
import { env } from './env'

// Cliente Redis compartido para módulos de dominio.
// La validación estricta de variables puede agregarse más adelante.

export const redis = new Redis({
  url: env.upstashRedisRestUrl,
  token: env.upstashRedisRestToken,
})

export type RedisClient = typeof redis