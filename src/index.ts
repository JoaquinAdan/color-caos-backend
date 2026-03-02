import { createServer } from 'http'
import { createApp } from './app'
import { env } from './config/env'
import { createSocketServer } from './socket/socket.server'

// Punto de entrada del servidor Node.js.
// Aquí se inicia HTTP, Socket.IO y cualquier proceso de bootstrap.
const app = createApp()
const httpServer = createServer(app)

createSocketServer(httpServer)

httpServer.listen(env.port, () => {
  console.log(`Server is running on http://localhost:${env.port}`)
})

export { app, httpServer }
