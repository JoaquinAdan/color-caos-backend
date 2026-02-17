// Tipos del dominio de jugadores.
// Definir aquí el contrato de datos que usa el módulo players.
export type PlayerId = string

export interface Player {
  id: PlayerId
  name: string
}