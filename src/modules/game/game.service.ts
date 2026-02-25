import { buildRoundCards, pickRandomItem } from './game.utils'
import { getRoomByCode, getRoomByCodeWithPlayers, saveRoom } from '../rooms/room.service'
import { GameMode, GamePhase, RoomStatus } from '../rooms/room.types'
import type { RoomCode, RoomWithPlayers } from '../rooms/room.types'

interface CreateGameServiceOptions {
  onRoomUpdated: (room: RoomWithPlayers) => void
}

type TimerRef = ReturnType<typeof setTimeout>
const ANSWER_GRACE_MS = 350

export const createGameService = ({ onRoomUpdated }: CreateGameServiceOptions) => {
  const timersByRoomCode = new Map<RoomCode, TimerRef[]>()

  const registerTimer = (roomCode: RoomCode, timer: TimerRef) => {
    const existing = timersByRoomCode.get(roomCode) ?? []
    existing.push(timer)
    timersByRoomCode.set(roomCode, existing)
  }

  const clearRoomTimers = (roomCode: RoomCode) => {
    const timers = timersByRoomCode.get(roomCode)
    if (!timers) return

    for (const timer of timers) {
      clearTimeout(timer)
    }
    timersByRoomCode.delete(roomCode)
  }

  const emitRoomUpdate = async (roomCode: RoomCode) => {
    const room = await getRoomByCodeWithPlayers(roomCode)
    if (room) {
      onRoomUpdated(room)
    }
  }

  const finishGame = async (roomCode: RoomCode) => {
    const room = await getRoomByCode(roomCode)
    if (!room) {
      clearRoomTimers(roomCode)
      return
    }

    room.status = RoomStatus.WAITING
    room.gameState.phase = GamePhase.FINISHED
    room.gameState.targetColor = null
    room.gameState.cards = []
    room.gameState.phaseEndsAt = null
    room.gameState.roundAnswers = {}
    room.completedGames = (room.completedGames ?? 0) + 1

    await saveRoom(room)
    await emitRoomUpdate(roomCode)
    clearRoomTimers(roomCode)
  }

  const startRoundAnsweringPhase = async (roomCode: RoomCode, roundNumber: number) => {
    const room = await getRoomByCode(roomCode)
    if (!room || room.status !== RoomStatus.IN_PROGRESS) {
      clearRoomTimers(roomCode)
      return
    }

    if (roundNumber > room.gameConfig.totalRounds) {
      await finishGame(roomCode)
      return
    }

    const cards = buildRoundCards(room.gameConfig.availableColors, room.gameConfig.cardsPerRound)
    const targetColor = cards.length > 0 ? pickRandomItem(cards) : null
    const now = Date.now()

    room.gameState.phase = GamePhase.ANSWERING
    room.gameState.currentRound = roundNumber
    room.gameState.cards = cards
    room.gameState.targetColor = targetColor
    room.gameState.startedAt = now
    room.gameState.phaseEndsAt = now + room.gameConfig.answerWindowSeconds * 1000
    room.gameState.roundAnswers = {}

    await saveRoom(room)
    await emitRoomUpdate(roomCode)

    const timer = setTimeout(async () => {
      await startRoundScoringPhase(roomCode, roundNumber)
    }, room.gameConfig.answerWindowSeconds * 1000)
    registerTimer(roomCode, timer)
  }

  const startRoundScoringPhase = async (roomCode: RoomCode, roundNumber: number) => {
    const room = await getRoomByCode(roomCode)
    if (!room || room.status !== RoomStatus.IN_PROGRESS) {
      clearRoomTimers(roomCode)
      return
    }

    if (room.gameState.currentRound !== roundNumber) {
      return
    }

    const targetColor = room.gameState.targetColor
    if (targetColor) {
      for (const [playerId, answer] of Object.entries(room.gameState.roundAnswers)) {
        const isCorrect =
          room.gameConfig.mode === GameMode.MATCH_TARGET
            ? answer === targetColor
            : answer !== targetColor

        if (isCorrect) {
          room.scoresByPlayerId[playerId] = (room.scoresByPlayerId[playerId] ?? 0) + 1
        }
      }
    }

    const now = Date.now()
    room.gameState.phase = GamePhase.SCORING
    room.gameState.startedAt = now
    room.gameState.phaseEndsAt = now + room.gameConfig.scoringWindowSeconds * 1000

    await saveRoom(room)
    await emitRoomUpdate(roomCode)

    const timer = setTimeout(async () => {
      await startRoundAnsweringPhase(roomCode, roundNumber + 1)
    }, room.gameConfig.scoringWindowSeconds * 1000)
    registerTimer(roomCode, timer)
  }

  const startGame = async (roomCode: RoomCode, hostPlayerId: string): Promise<RoomWithPlayers> => {
    const room = await getRoomByCode(roomCode)
    if (!room) {
      throw new Error('La sala no existe o ha expirado')
    }

    if (room.hostId !== hostPlayerId) {
      throw new Error('Solo el anfitrión puede iniciar la partida')
    }

    if (room.status === RoomStatus.IN_PROGRESS) {
      throw new Error('La partida ya está en progreso')
    }

    if (room.playerIds.length < 2) {
      throw new Error('Se necesitan al menos 2 jugadores para comenzar')
    }

    if (room.gameConfig.cardsPerRound > room.gameConfig.availableColors.length) {
      throw new Error('La configuración actual requiere más tarjetas únicas que colores disponibles')
    }

    clearRoomTimers(roomCode)

    for (const playerId of room.playerIds) {
      if (room.scoresByPlayerId[playerId] === undefined) {
        room.scoresByPlayerId[playerId] = 0
      }
    }

    const now = Date.now()
    room.status = RoomStatus.IN_PROGRESS
    room.startedAt = now
    room.gameState.phase = GamePhase.PRE_GAME_COUNTDOWN
    room.gameState.currentRound = 0
    room.gameState.targetColor = null
    room.gameState.cards = []
    room.gameState.startedAt = now
    room.gameState.phaseEndsAt = now + room.gameConfig.preGameCountdownSeconds * 1000
    room.gameState.roundAnswers = {}

    await saveRoom(room)

    const updatedRoom = await getRoomByCodeWithPlayers(roomCode)
    if (!updatedRoom) {
      throw new Error('No se pudo iniciar la partida')
    }
    onRoomUpdated(updatedRoom)

    const timer = setTimeout(async () => {
      await startRoundAnsweringPhase(roomCode, 1)
    }, room.gameConfig.preGameCountdownSeconds * 1000)
    registerTimer(roomCode, timer)

    return updatedRoom
  }

  const submitAnswer = async (
    roomCode: RoomCode,
    playerId: string,
    color: string
  ): Promise<{ accepted: boolean; room: RoomWithPlayers }> => {
    const room = await getRoomByCode(roomCode)
    if (!room) {
      throw new Error('La sala no existe o ha expirado')
    }

    if (!room.playerIds.includes(playerId)) {
      throw new Error('No perteneces a esta sala')
    }

    if (room.status !== RoomStatus.IN_PROGRESS) {
      const unchangedRoom = await getRoomByCodeWithPlayers(roomCode)
      if (!unchangedRoom) {
        throw new Error('No se pudo obtener el estado de sala')
      }
      return { accepted: false, room: unchangedRoom }
    }

    const now = Date.now()
    const isAnswering = room.gameState.phase === GamePhase.ANSWERING
    const isScoringWithinGrace =
      room.gameState.phase === GamePhase.SCORING &&
      room.gameState.startedAt !== null &&
      now - room.gameState.startedAt <= ANSWER_GRACE_MS

    if (!isAnswering && !isScoringWithinGrace) {
      const unchangedRoom = await getRoomByCodeWithPlayers(roomCode)
      if (!unchangedRoom) {
        throw new Error('No se pudo obtener el estado de sala')
      }
      return { accepted: false, room: unchangedRoom }
    }

    if (!room.gameState.cards.includes(color)) {
      throw new Error('Color inválido para esta ronda')
    }

    // Se permite una sola respuesta por jugador en cada ronda.
    if (room.gameState.roundAnswers[playerId]) {
      const unchangedRoom = await getRoomByCodeWithPlayers(roomCode)
      if (!unchangedRoom) {
        throw new Error('No se pudo obtener el estado de sala')
      }
      return { accepted: false, room: unchangedRoom }
    }

    room.gameState.roundAnswers[playerId] = color

    // Si llegó justo al borde y la fase de scoring ya comenzó, sumamos el punto acá.
    if (isScoringWithinGrace && room.gameState.targetColor) {
      const isCorrectAtEdge =
        room.gameConfig.mode === GameMode.MATCH_TARGET
          ? room.gameState.targetColor === color
          : room.gameState.targetColor !== color

      if (isCorrectAtEdge) {
        room.scoresByPlayerId[playerId] = (room.scoresByPlayerId[playerId] ?? 0) + 1
      }
    }

    await saveRoom(room)

    const updatedRoom = await getRoomByCodeWithPlayers(roomCode)
    if (!updatedRoom) {
      throw new Error('No se pudo obtener el estado actualizado de sala')
    }

    onRoomUpdated(updatedRoom)
    return { accepted: true, room: updatedRoom }
  }

  return {
    startGame,
    submitAnswer,
    clearRoomTimers,
  }
}

export type GameService = ReturnType<typeof createGameService>
