import type { Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { registerSocketEvents } from './socket.events'
import type { ClientToServerEvents, ServerToClientEvents } from './socket.types'
import { createGameService } from '../modules/game/game.service'

// ============================================
// CONFIGURACIÓN DE SOCKET.IO
// ============================================
// Inicializa Socket.IO sobre el servidor HTTP.
// Aquí se configuran CORS, middlewares y se registran eventos.

export const createSocketServer = (httpServer: HttpServer) => {
  // PASO 1: Crear instancia de Socket.IO con tipos
  // Los tipos aseguran que solo uses eventos definidos en socket.types.ts
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: '*', // En producción, especifica dominios permitidos
      methods: ['GET', 'POST'],
    },
  })

  console.log('[Socket.IO] Servidor inicializado')

  const gameService = createGameService({
    onRoomUpdated: (room) => {
      io.to(room.code).emit('room:updated', { room })
    },
  })

  // PASO 2: Escuchar nuevas conexiones
  // Cada vez que un cliente se conecta, se ejecuta este callback
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Nueva conexión: ${socket.id}`)

    // PASO 3: Registrar todos los eventos personalizados
    // Esto conecta los eventos del cliente con la lógica de negocio
    registerSocketEvents(socket, io, gameService)

    // PASO 4: Enviar confirmación de conexión al cliente
    socket.emit('system:connected', { ok: true })
  })

  return io
}
