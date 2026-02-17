import type { Player } from './player.types'

// Servicio del dominio players.
// Aquí irá la lógica de registro, desconexión y estado del jugador.
export const createPlayerService = () => {
  const getPlayerById = (_playerId: string): Player | null => null

  return {
    getPlayerById,
  }
}