import express from 'express'
import { healthRouter } from './http/health.route'

// Composición principal de la app HTTP.
// Aquí se registran middlewares globales, rutas y manejo de errores.
export const createApp = () => {
  const app = express()

  app.use(express.json())
  app.use('/api', healthRouter)

  return app
}