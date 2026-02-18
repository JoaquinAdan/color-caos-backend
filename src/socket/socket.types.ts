// Tipos de eventos y payloads de Socket.IO.
// Definir aquí contratos cliente-servidor para tiempo real.

import type { Room, RoomWithPlayers } from '../modules/rooms/room.types'
import type { Player } from '../modules/players/player.types'

// ============================================
// EVENTOS DEL SERVIDOR AL CLIENTE
// ============================================
export interface ServerToClientEvents {
  // Sistema
  'system:connected': (payload: { ok: boolean }) => void

  // Jugadores - Respuesta cuando se crea un jugador exitosamente
  'player:created': (payload: {
    player: Player
  }) => void

  // Salas - Respuesta cuando se crea una sala exitosamente
  'room:created': (payload: {
    room: RoomWithPlayers
  }) => void

  // Salas - Respuesta cuando un jugador se une a una sala exitosamente
  'room:joined': (payload: {
    room: RoomWithPlayers
  }) => void

  // Salas - Actualización cuando cambia el estado de la sala
  'room:updated': (payload: {
    room: RoomWithPlayers
  }) => void
  
  // Error genérico
  'error': (payload: { message: string; code?: string }) => void
}

// ============================================
// EVENTOS DEL CLIENTE AL SERVIDOR
// ============================================
export interface ClientToServerEvents {
  // Jugadores - Crear un jugador temporal
  'player:create': (
    payload: { name: string },
    callback?: (response: {
      success: boolean
      player?: Player
      error?: string
    }) => void
  ) => void

  // Jugadores - Obtener un jugador por ID (validar si aún existe)
  'player:get': (
    payload: { playerId: string },
    callback?: (response: {
      success: boolean
      player?: Player | null
      exists: boolean
      error?: string
    }) => void
  ) => void

  // Salas - Crear una nueva partida
  'room:create': (
    payload: { maxPlayers?: number; playerId: string },
    callback?: (response: {
      success: boolean
      room?: RoomWithPlayers
      error?: string
    }) => void
  ) => void

  // Salas - Obtener una sala por código
  'room:get': (
    payload: { roomCode: string },
    callback?: (response: {
      success: boolean
      room?: RoomWithPlayers | null
      error?: string
    }) => void
  ) => void

  // Salas - Unirse a una sala existente
  'room:join': (
    payload: { roomCode: string; playerId: string },
    callback?: (response: {
      success: boolean
      room?: RoomWithPlayers
      error?: string
    }) => void
  ) => void

  // Salas - Salir de una sala
  'room:leave': (
    payload: { roomCode: string; playerId: string },
    callback?: (response: {
      success: boolean
      wasDeleted?: boolean
      error?: string
    }) => void
  ) => void
  
  // Players - Unirse a una sala existente
  'player:join': (payload: { roomCode: string; name: string }) => void
}