// Tipos del dominio de salas.
// Definir aquí estados de room, jugadores conectados y configuración.
export type RoomId = string

export interface Room {
  id: RoomId
  code: string
}