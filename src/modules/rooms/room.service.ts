import type { Room } from './room.types'

// Servicio del dominio rooms.
// Aquí irá la lógica para crear salas, unir jugadores y cerrar partidas.
export const createRoomService = () => {
  const getRoomById = (_roomId: string): Room | null => null

  return {
    getRoomById,
  }
}