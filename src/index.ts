import { createServer } from 'http'
import { createApp } from './app'
import { env } from './config/env'
import { createSocketServer } from './socket/socket.server'

// Punto de entrada del servidor Node.js.
// Aquí se inicia HTTP, Socket.IO y cualquier proceso de bootstrap.
const app = createApp()
const httpServer = createServer(app)
const host = '0.0.0.0'

createSocketServer(httpServer)

httpServer.listen(env.port, host, () => {
  console.log(`Server is running on http://${host}:${env.port}`)
})

export { app, httpServer }
