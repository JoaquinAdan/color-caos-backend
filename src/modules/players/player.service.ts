import { redis } from '../../config/redis'
import type { Player, PlayerId } from './player.types'
import { nanoid } from 'nanoid'
import { PLAYER_TTL_SECONDS } from '../../config/ttl.constants'

// Servicio del dominio players.
// Aquí irá la lógica de registro, desconexión y estado del jugador.

const PLAYER_KEY_PREFIX = 'player:'

/**
 * Crea un jugador temporal con nombre y ID generado aleatoriamente
 * El jugador expira automáticamente después del TTL configurado (por defecto 12 horas)
 */
export const createPlayer = async (name: string): Promise<Player> => {
  // Validar que el nombre no esté vacío
  if (!name || name.trim().length === 0) {
    throw new Error('El nombre del jugador no puede estar vacío')
  }

  // Validar longitud del nombre
  if (name.trim().length > 50) {
    throw new Error('El nombre del jugador no puede exceder 50 caracteres')
  }

  const playerId: PlayerId = nanoid()
  const now = Date.now()
  
  const player: Player = {
    id: playerId,
    name: name.trim(),
    currentRoomCode: null,
    createdAt: now,
    lastActivityAt: now,
  }

  // Guardar el jugador en Redis con TTL (Upstash serializa automáticamente)
  await redis.set(`${PLAYER_KEY_PREFIX}${playerId}`, player, {
    ex: PLAYER_TTL_SECONDS,
  })

  console.log(`[PlayerService] Jugador creado: ${playerId} (nombre: ${player.name})`)

  return player
}

/**
 * Obtiene un jugador por su ID
 */
export const getPlayerById = async (playerId: PlayerId): Promise<Player | null> => {
  const player = await redis.get<Player>(`${PLAYER_KEY_PREFIX}${playerId}`)
  
  if (!player) {
    return null
  }

  return player
}

/**
 * Actualiza la última actividad del jugador y renueva el TTL
 */
export const updatePlayerActivity = async (playerId: PlayerId): Promise<void> => {
  const player = await getPlayerById(playerId)
  
  if (!player) {
    throw new Error('Jugador no encontrado')
  }

  player.lastActivityAt = Date.now()

  // Actualizar en Redis y renovar TTL (Upstash serializa automáticamente)
  await redis.set(`${PLAYER_KEY_PREFIX}${playerId}`, player, {
    ex: PLAYER_TTL_SECONDS,
  })

  console.log(`[PlayerService] Actividad actualizada para jugador: ${playerId}`)
}

/**
 * Actualiza la sala actual del jugador
 */
export const updatePlayerRoom = async (playerId: PlayerId, roomCode: string | null): Promise<void> => {
  const player = await getPlayerById(playerId)
  
  if (!player) {
    throw new Error('Jugador no encontrado')
  }

  player.currentRoomCode = roomCode
  player.lastActivityAt = Date.now()

  // Actualizar en Redis y renovar TTL
  await redis.set(`${PLAYER_KEY_PREFIX}${playerId}`, player, {
    ex: PLAYER_TTL_SECONDS,
  })

  console.log(`[PlayerService] Sala actualizada para jugador ${playerId}: ${roomCode ?? 'null'}`)
}

export const createPlayerService = () => {
  return {
    createPlayer,
    getPlayerById,
    updatePlayerActivity,
    updatePlayerRoom,
  }
}