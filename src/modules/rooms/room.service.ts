import { redis } from '../../config/redis'
import type { Room, RoomCode, RoomId, RoomWithPlayers, RoomPlayer, GameConfig, GameState } from './room.types'
import { GameMode, GamePhase, RoomStatus } from './room.types'
import { nanoid } from 'nanoid'
import { ROOM_TTL_SECONDS } from '../../config/ttl.constants'
import { getPlayerById } from '../players/player.service'

// Servicio del dominio rooms.
// Aquí irá la lógica para crear salas, unir jugadores y cerrar partidas.

const ROOM_KEY_PREFIX = 'room:'
const ROOM_CODE_KEY_PREFIX = 'room:code:'

export const DEFAULT_GAME_CONFIG: GameConfig = {
  preGameCountdownSeconds: 5,
  totalRounds: 6,
  cardsPerRound: 5,
  answerWindowSeconds: 2,
  scoringWindowSeconds: 3,
  availableColors: ['red', 'blue', 'green', 'yellow', 'orange', 'pink', 'purple', 'cyan'],
  mode: GameMode.MATCH_TARGET,
}

const createIdleGameState = (): GameState => ({
  phase: GamePhase.IDLE,
  currentRound: 0,
  targetColor: null,
  cards: [],
  startedAt: null,
  phaseEndsAt: null,
  roundAnswers: {},
})

const resetFinishedGamePresentation = (room: Room): void => {
  if (room.status === RoomStatus.WAITING && room.gameState.phase === GamePhase.FINISHED) {
    room.gameState.phase = GamePhase.IDLE
    room.gameState.currentRound = 0
    room.gameState.targetColor = null
    room.gameState.cards = []
    room.gameState.phaseEndsAt = null
    room.gameState.roundAnswers = {}
  }
}

/**
 * Genera un código de sala único de 6 caracteres alfanuméricos en mayúsculas
 */
const generateRoomCode = (): RoomCode => {
  return nanoid(6).toUpperCase()
}

/**
 * Verifica si un código de sala ya existe en Redis
 */
const roomCodeExists = async (code: RoomCode): Promise<boolean> => {
  const roomId = await redis.get<string>(`${ROOM_CODE_KEY_PREFIX}${code}`)
  return roomId !== null
}

/**
 * Genera un código de sala único que no exista en Redis
 */
const generateUniqueRoomCode = async (): Promise<RoomCode> => {
  let code = generateRoomCode()
  let attempts = 0
  const maxAttempts = 10

  while (await roomCodeExists(code)) {
    attempts++
    if (attempts >= maxAttempts) {
      throw new Error('No se pudo generar un código de sala único')
    }
    code = generateRoomCode()
  }

  return code
}

/**
 * Convierte una Room a RoomWithPlayers obteniendo los datos de los jugadores
 */
const populateRoomWithPlayers = async (room: Room): Promise<RoomWithPlayers> => {
  const players: RoomPlayer[] = []
  
  // Obtener datos de cada jugador
  for (const playerId of room.playerIds) {
    const player = await getPlayerById(playerId)
    if (player) {
      players.push({
        id: player.id,
        name: player.name,
      })
    }
  }
  
  return {
    ...room,
    players,
    serverNow: Date.now(),
  }
}

/**
 * Crea una nueva sala de juego
 */
export const createRoom = async (hostId: string, maxPlayers = 8): Promise<RoomWithPlayers> => {
  const roomId: RoomId = nanoid()
  const roomCode = await generateUniqueRoomCode()
  
  const room: Room = {
    id: roomId,
    code: roomCode,
    status: RoomStatus.WAITING,
    hostId,
    playerIds: [hostId],
    maxPlayers,
    createdAt: Date.now(),
    startedAt: null,
    gameConfig: {
      ...DEFAULT_GAME_CONFIG,
      availableColors: [...DEFAULT_GAME_CONFIG.availableColors],
    },
    gameState: createIdleGameState(),
    scoresByPlayerId: {
      [hostId]: 0,
    },
    completedGames: 0,
  }

  // Guardar la sala en Redis con TTL (Upstash serializa automáticamente)
  await redis.set(`${ROOM_KEY_PREFIX}${roomId}`, room, {
    ex: ROOM_TTL_SECONDS,
  })

  // Guardar el mapeo código -> roomId para búsquedas rápidas
  await redis.set(`${ROOM_CODE_KEY_PREFIX}${roomCode}`, roomId, {
    ex: ROOM_TTL_SECONDS,
  })

  console.log(`[RoomService] Sala creada: ${roomId} (código: ${roomCode})`)

  return populateRoomWithPlayers(room)
}

/**
 * Obtiene una sala por su ID
 */
export const getRoomById = async (roomId: RoomId): Promise<Room | null> => {
  const room = await redis.get<Room>(`${ROOM_KEY_PREFIX}${roomId}`)
  
  if (!room) {
    return null
  }

  return room
}

/**
 * Obtiene una sala por su código
 */
export const getRoomByCode = async (code: RoomCode): Promise<Room | null> => {
  const roomId = await redis.get<string>(`${ROOM_CODE_KEY_PREFIX}${code}`)
  
  if (!roomId) {
    return null
  }

  return getRoomById(roomId)
}

/**
 * Guarda una sala en Redis renovando el TTL
 */
export const saveRoom = async (room: Room): Promise<void> => {
  await redis.set(`${ROOM_KEY_PREFIX}${room.id}`, room, {
    ex: ROOM_TTL_SECONDS,
  })
}

/**
 * Obtiene una sala por su código con datos de jugadores
 */
export const getRoomByCodeWithPlayers = async (code: RoomCode): Promise<RoomWithPlayers | null> => {
  const room = await getRoomByCode(code)
  
  if (!room) {
    return null
  }

  return populateRoomWithPlayers(room)
}

/**
 * Permite que un jugador se una a una sala existente
 */
export const joinRoom = async (roomCode: RoomCode, playerId: string): Promise<RoomWithPlayers> => {
  // Obtener la sala por código
  const room = await getRoomByCode(roomCode)
  
  if (!room) {
    throw new Error('La sala no existe o ha expirado')
  }

  // Verificar si la sala está llena
  if (room.playerIds.length >= room.maxPlayers) {
    throw new Error('La sala está llena')
  }

  // Verificar si el jugador ya está en la sala
  if (room.playerIds.includes(playerId)) {
    throw new Error('Ya estás en esta sala')
  }

  // Agregar el jugador a la sala
  room.playerIds.push(playerId)
  if (room.scoresByPlayerId[playerId] === undefined) {
    room.scoresByPlayerId[playerId] = 0
  }
  resetFinishedGamePresentation(room)

  // Actualizar la sala en Redis (Upstash serializa automáticamente)
  await saveRoom(room)

  console.log(`[RoomService] Jugador ${playerId} se unió a la sala ${room.code}`)

  return populateRoomWithPlayers(room)
}

/**
 * Permite que un jugador salga de una sala
 * - Si es el último jugador, elimina la sala
 * - Si es el host y hay más jugadores, transfiere el host al siguiente
 * - Si es un jugador normal, solo lo remueve
 */
export const leaveRoom = async (roomCode: RoomCode, playerId: string): Promise<{ room: RoomWithPlayers | null; wasDeleted: boolean; newHostId: string | null }> => {
  // Obtener la sala por código
  const room = await getRoomByCode(roomCode)
  
  if (!room) {
    throw new Error('La sala no existe o ha expirado')
  }

  // Verificar si el jugador está en la sala
  if (!room.playerIds.includes(playerId)) {
    throw new Error('No estás en esta sala')
  }

  // Remover el jugador de la sala
  room.playerIds = room.playerIds.filter(id => id !== playerId)

  // Caso 1: Si no quedan jugadores, eliminar la sala
  if (room.playerIds.length === 0) {
    await redis.del(`${ROOM_KEY_PREFIX}${room.id}`)
    await redis.del(`${ROOM_CODE_KEY_PREFIX}${room.code}`)
    console.log(`[RoomService] Sala ${room.code} eliminada (no quedan jugadores)`)
    return { room: null, wasDeleted: true, newHostId: null }
  }

  let newHostId: string | null = null

  // Caso 2: Si el que salió era el host, transferir el liderazgo
  if (room.hostId === playerId) {
    room.hostId = room.playerIds[0]
    newHostId = room.hostId
    console.log(`[RoomService] Host transferido a ${newHostId}`)
  }

  // Actualizar la sala en Redis
  await saveRoom(room)

  console.log(`[RoomService] Jugador ${playerId} salió de la sala ${room.code}`)

  const updatedRoom = await populateRoomWithPlayers(room)
  return { room: updatedRoom, wasDeleted: false, newHostId }
}

/**
 * Actualiza la configuración de una sala (solo el host puede hacerlo)
 */
export const updateRoomSettings = async (
  roomCode: RoomCode, 
  maxPlayers: number,
  hostPlayerId: string,
  gameMode: GameMode
): Promise<RoomWithPlayers> => {
  // Obtener la sala por código
  const room = await getRoomByCode(roomCode)
  
  if (!room) {
    throw new Error('La sala no existe o ha expirado')
  }

  if (room.hostId !== hostPlayerId) {
    throw new Error('Solo el anfitrión puede actualizar la configuración')
  }

  // Validar maxPlayers
  if (maxPlayers < 2 || maxPlayers > 20) {
    throw new Error('El número de jugadores debe estar entre 2 y 20')
  }

  // Validar que el nuevo maxPlayers no sea menor que el número actual de jugadores
  if (maxPlayers < room.playerIds.length) {
    throw new Error(`No puedes reducir el límite por debajo del número actual de jugadores (${room.playerIds.length})`)
  }

  if (![GameMode.MATCH_TARGET, GameMode.AVOID_TARGET].includes(gameMode)) {
    throw new Error('Modo de juego inválido')
  }

  // Actualizar la configuración
  room.maxPlayers = maxPlayers
  room.gameConfig.mode = gameMode

  // Actualizar la sala en Redis
  await saveRoom(room)

  console.log(`[RoomService] Configuración de sala ${room.code} actualizada: maxPlayers=${maxPlayers}`)

  return populateRoomWithPlayers(room)
}

/**
 * Expulsa a un jugador de una sala (solo el host puede hacerlo)
 */
export const kickPlayerFromRoom = async (
  roomCode: RoomCode,
  hostPlayerId: string,
  targetPlayerId: string
): Promise<{ room: RoomWithPlayers | null; wasDeleted: boolean }> => {
  const room = await getRoomByCode(roomCode)

  if (!room) {
    throw new Error('La sala no existe o ha expirado')
  }

  if (room.hostId !== hostPlayerId) {
    throw new Error('Solo el anfitrión puede expulsar jugadores')
  }

  if (targetPlayerId === hostPlayerId) {
    throw new Error('El anfitrión no puede expulsarse a sí mismo')
  }

  if (!room.playerIds.includes(targetPlayerId)) {
    throw new Error('El jugador no está en esta sala')
  }

  const { room: updatedRoom, wasDeleted } = await leaveRoom(roomCode, targetPlayerId)
  return { room: updatedRoom, wasDeleted }
}

export const createRoomService = () => {
  return {
    createRoom,
    getRoomById,
    getRoomByCode,
    getRoomByCodeWithPlayers,
    joinRoom,
    leaveRoom,
    kickPlayerFromRoom,
  }
}
