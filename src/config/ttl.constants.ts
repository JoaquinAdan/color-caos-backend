// ============================================
// CONSTANTES DE TTL (Time To Live) EN REDIS
// ============================================
// Aquí se definen los tiempos de expiración para diferentes entidades.
// Todos los valores están en SEGUNDOS.

/**
 * TTL para jugadores temporales
 * Por defecto: 12 horas (43200 segundos)
 * Los jugadores deben volver a ingresar su nombre al día siguiente
 */
export const PLAYER_TTL_SECONDS = 60 * 60 * 12 // 12 horas

/**
 * TTL para salas de juego
 * Por defecto: 1 hora (3600 segundos)
 * Las salas se eliminan automáticamente si no hay actividad
 */
export const ROOM_TTL_SECONDS = 60 * 60 // 1 hora

/**
 * TTL para sesiones de ronda
 * Por defecto: 30 minutos (1800 segundos)
 * Las rondas activas expiran si no se completan
 */
export const ROUND_TTL_SECONDS = 60 * 30 // 30 minutos
