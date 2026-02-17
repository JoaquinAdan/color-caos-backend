import { Router } from 'express'

// Rutas HTTP básicas del sistema.
// Aquí luego se pueden dividir rutas por dominio (players, rooms, game).
export const healthRouter = Router()

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})