// Tipos del dominio de salas.
// Definir aquí estados de room, jugadores conectados y configuración.
export type RoomId = string
export type RoomCode = string

export enum RoomStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
}

export enum GamePhase {
  IDLE = 'idle',
  PRE_GAME_COUNTDOWN = 'pre_game_countdown',
  ANSWERING = 'answering',
  SCORING = 'scoring',
  FINISHED = 'finished',
}

export interface GameConfig {
  preGameCountdownSeconds: number
  totalRounds: number
  cardsPerRound: number
  answerWindowSeconds: number
  scoringWindowSeconds: number
  availableColors: string[]
  mode: GameMode
}

export enum GameMode {
  MATCH_TARGET = 'match_target',
  AVOID_TARGET = 'avoid_target',
}

export interface GameState {
  phase: GamePhase
  currentRound: number
  targetColor: string | null
  cards: string[]
  startedAt: number | null
  phaseEndsAt: number | null
  roundAnswers: Record<string, string>
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
  gameConfig: GameConfig
  gameState: GameState
  scoresByPlayerId: Record<string, number>
  completedGames: number
}

export interface RoomPlayer {
  id: string
  name: string
}

export interface RoomWithPlayers extends Room {
  players: RoomPlayer[]
  serverNow?: number
}
