// Tipos del dominio de salas.
// Definir aquí estados de room, jugadores conectados y configuración.
export type RoomId = string
export type RoomCode = string

export enum RoomStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
}

export interface Room {
  id: RoomId
  code: RoomCode
  status: RoomStatus
  hostId: string | null
  playerIds: string[]
  maxPlayers: number
  createdAt: number
  startedAt: number | null
}

export interface RoomPlayer {
  id: string
  name: string
}

export interface RoomWithPlayers extends Room {
  players: RoomPlayer[]
}