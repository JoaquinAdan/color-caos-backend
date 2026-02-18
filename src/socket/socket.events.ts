import type { Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from './socket.types'
import { createRoom, joinRoom, leaveRoom, getRoomByCodeWithPlayers } from '../modules/rooms/room.service'
import { createPlayer, getPlayerById, updatePlayerRoom } from '../modules/players/player.service'

// ============================================
// REGISTRO CENTRAL DE EVENTOS POR CONEXIÓN
// ============================================
// Aquí se mapean todos los eventos que el cliente puede emitir
// y se conectan con la lógica de negocio (servicios).

export const registerSocketEvents = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) => {
  console.log(`[Socket] Cliente conectado: ${socket.id}`)

  // ============================================
  // EVENTO: player:create
  // ============================================
  // FLUJO COMPLETO:
  // 1. Cliente emite 'player:create' con su nombre
  // 2. Backend recibe el evento aquí
  // 3. Llama al servicio que crea el jugador en Redis
  // 4. El servicio genera un ID único
  // 5. Guarda el jugador en Redis con TTL de 12 horas
  // 6. Backend emite 'player:created' de vuelta al cliente
  // ============================================
  
  socket.on('player:create', async (payload, callback) => {
    try {
      console.log(`[player:create] Solicitud recibida de cliente: ${socket.id}`)

      const { name } = payload

      if (!name) {
        throw new Error('El nombre es requerido')
      }

      // PASO 1: Llamar al servicio que maneja la lógica de Redis
      // Este servicio está en src/modules/players/player.service.ts
      const player = await createPlayer(name)

      console.log(`[player:create] Jugador creado exitosamente:`, player)

      // PASO 2: Emitir evento al cliente con el resultado
      // Esto envía la respuesta en tiempo real
      socket.emit('player:created', { player })

      // PASO 3: Si el cliente envió un callback, responder también por ahí
      if (callback) {
        callback({ success: true, player })
      }

      console.log(`[player:create] Respuesta enviada al cliente ${socket.id}`)
    } catch (error) {
      // MANEJO DE ERRORES
      // Si algo falla (Redis caído, validación, etc.)
      console.error(`[player:create] Error:`, error)

      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

      // Emitir evento de error al cliente
      socket.emit('error', {
        message: `Error al crear jugador: ${errorMessage}`,
        code: 'CREATE_PLAYER_ERROR',
      })

      // Responder también en el callback si existe
      if (callback) {
        callback({
          success: false,
          error: errorMessage,
        })
      }
    }
  })

  // ============================================
  // EVENTO: player:get
  // ============================================
  // FLUJO COMPLETO:
  // 1. Cliente emite 'player:get' con el ID del jugador
  // 2. Backend recibe el evento aquí
  // 3. Consulta Redis para verificar si el jugador existe
  // 4. Si existe, devuelve los datos del jugador
  // 5. Si no existe (expiró el TTL), devuelve null
  // 6. Esto permite al frontend saber si debe crear un nuevo jugador
  // ============================================
  
  socket.on('player:get', async (payload, callback) => {
    try {
      console.log(`[player:get] Solicitud recibida de cliente: ${socket.id}`)

      const { playerId } = payload

      if (!playerId) {
        throw new Error('El ID del jugador es requerido')
      }

      // PASO 1: Buscar el jugador en Redis
      const player = await getPlayerById(playerId)

      const exists = player !== null

      console.log(`[player:get] Jugador ${playerId}: ${exists ? 'encontrado' : 'no existe'}`)

      // PASO 2: Responder con el resultado
      if (callback) {
        callback({
          success: true,
          player,
          exists,
        })
      }

      console.log(`[player:get] Respuesta enviada al cliente ${socket.id}`)
    } catch (error) {
      // MANEJO DE ERRORES
      console.error(`[player:get] Error:`, error)

      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

      // Emitir evento de error al cliente
      socket.emit('error', {
        message: `Error al obtener jugador: ${errorMessage}`,
        code: 'GET_PLAYER_ERROR',
      })

      // Responder también en el callback si existe
      if (callback) {
        callback({
          success: false,
          exists: false,
          error: errorMessage,
        })
      }
    }
  })

  // ============================================
  // EVENTO: room:create
  // ============================================
  // FLUJO COMPLETO:
  // 1. Cliente emite 'room:create'
  // 2. Backend recibe el evento aquí
  // 3. Llama al servicio que crea la sala en Redis
  // 4. El servicio genera un código único de sala
  // 5. Guarda la sala en Redis con TTL de 1 hora
  // 6. Backend emite 'room:created' de vuelta al cliente
  // ============================================
  
  socket.on('room:create', async (payload, callback) => {
    try {
      console.log(`[room:create] Solicitud recibida de cliente: ${socket.id}`)

      const { maxPlayers = 8, playerId } = payload

      // Validar playerId
      if (!playerId) {
        throw new Error('El ID del jugador es requerido')
      }

      // Validar maxPlayers
      if (maxPlayers < 2 || maxPlayers > 20) {
        throw new Error('El número de jugadores debe estar entre 2 y 20')
      }

      // PASO 1: Llamar al servicio que maneja la lógica de Redis
      // Este servicio está en src/modules/rooms/room.service.ts
      const room = await createRoom(playerId, maxPlayers)

      console.log(`[room:create] Sala creada exitosamente:`, room)

      // PASO 1.5: Actualizar la sala actual del jugador en Redis
      await updatePlayerRoom(playerId, room.code)

      // PASO 2: Unir el socket a la sala de Socket.IO
      socket.join(room.code)
      console.log(`[room:create] Socket ${socket.id} unido a la sala ${room.code}`)

      // Guardar referencia de la sala y playerId en el socket
      socket.data.roomCode = room.code
      socket.data.playerId = playerId

      // PASO 3: Emitir evento al cliente con el resultado
      // Esto envía la respuesta en tiempo real
      socket.emit('room:created', { room })

      // PASO 4: Si el cliente envió un callback, responder también por ahí
      if (callback) {
        callback({ success: true, room })
      }

      console.log(`[room:create] Respuesta enviada al cliente ${socket.id}`)
    } catch (error) {
      // MANEJO DE ERRORES
      // Si algo falla (Redis caído, error de red, etc.)
      console.error(`[room:create] Error:`, error)

      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

      // Emitir evento de error al cliente
      socket.emit('error', {
        message: `Error al crear sala: ${errorMessage}`,
        code: 'CREATE_ROOM_ERROR',
      })

      // Responder también en el callback si existe
      if (callback) {
        callback({
          success: false,
          error: errorMessage,
        })
      }
    }
  })

  // ============================================
  // EVENTO: room:get
  // ============================================
  // FLUJO COMPLETO:
  // 1. Cliente emite 'room:get' con el código de la sala
  // 2. Backend busca la sala en Redis
  // 3. Si existe, devuelve los datos con jugadores
  // 4. Si no existe, devuelve null
  // ============================================
  
  socket.on('room:get', async (payload, callback) => {
    try {
      console.log(`[room:get] Solicitud recibida de cliente: ${socket.id}`)

      const { roomCode } = payload

      if (!roomCode) {
        throw new Error('El código de la sala es requerido')
      }

      // PASO 1: Buscar la sala en Redis
      const room = await getRoomByCodeWithPlayers(roomCode)

      console.log(`[room:get] Sala ${roomCode}: ${room ? 'encontrada' : 'no existe'}`)

      // PASO 2: Responder con el resultado
      if (callback) {
        callback({
          success: true,
          room,
        })
      }

      console.log(`[room:get] Respuesta enviada al cliente ${socket.id}`)
    } catch (error) {
      // MANEJO DE ERRORES
      console.error(`[room:get] Error:`, error)

      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

      // Emitir evento de error al cliente
      socket.emit('error', {
        message: `Error al obtener sala: ${errorMessage}`,
        code: 'GET_ROOM_ERROR',
      })

      // Responder también en el callback si existe
      if (callback) {
        callback({
          success: false,
          error: errorMessage,
        })
      }
    }
  })

  // ============================================
  // EVENTO: room:join
  // ============================================
  // FLUJO COMPLETO:
  // 1. Cliente emite 'room:join' con el código de la sala y su ID de jugador
  // 2. Backend recibe el evento aquí
  // 3. Llama al servicio que agrega el jugador a la sala en Redis
  // 4. Verifica que la sala exista y no esté llena
  // 5. Actualiza la sala con el nuevo jugador
  // 6. Backend emite 'room:joined' de vuelta al cliente
  // ============================================
  
  socket.on('room:join', async (payload, callback) => {
    try {
      console.log(`[room:join] Solicitud recibida de cliente: ${socket.id}`)

      const { roomCode, playerId } = payload

      if (!roomCode) {
        throw new Error('El código de la sala es requerido')
      }

      if (!playerId) {
        throw new Error('El ID del jugador es requerido')
      }

      // PASO 1: Llamar al servicio que agrega el jugador a la sala
      const room = await joinRoom(roomCode, playerId)

      console.log(`[room:join] Jugador ${playerId} se unió a la sala exitosamente:`, room)

      // PASO 1.5: Actualizar la sala actual del jugador en Redis
      await updatePlayerRoom(playerId, room.code)

      // PASO 2: Unir el socket a la sala de Socket.IO
      socket.join(room.code)
      console.log(`[room:join] Socket ${socket.id} unido a la sala ${room.code}`)

      // Guardar referencia de la sala y playerId en el socket
      socket.data.roomCode = room.code
      socket.data.playerId = playerId

      // PASO 3: Emitir evento al cliente que se unió
      socket.emit('room:joined', { room })

      // PASO 4: Notificar a todos los demás jugadores en la sala
      socket.to(room.code).emit('room:updated', { room })
      console.log(`[room:join] Evento room:updated enviado a sala ${room.code}`)

      // PASO 5: Si el cliente envió un callback, responder también por ahí
      if (callback) {
        callback({ success: true, room })
      }

      console.log(`[room:join] Respuesta enviada al cliente ${socket.id}`)
    } catch (error) {
      // MANEJO DE ERRORES
      console.error(`[room:join] Error:`, error)

      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

      // Emitir evento de error al cliente
      socket.emit('error', {
        message: `Error al unirse a la sala: ${errorMessage}`,
        code: 'JOIN_ROOM_ERROR',
      })

      // Responder también en el callback si existe
      if (callback) {
        callback({
          success: false,
          error: errorMessage,
        })
      }
    }
  })

  // ============================================
  // EVENTO: room:leave
  // ============================================
  // FLUJO COMPLETO:
  // 1. Cliente emite 'room:leave' con el código de la sala y su ID de jugador
  // 2. Backend remueve al jugador de la sala
  // 3. Si era el último jugador, elimina la sala
  // 4. Si era el host, transfiere el liderazgo
  // 5. Notifica a los jugadores restantes
  // ============================================
  
  socket.on('room:leave', async (payload, callback) => {
    try {
      console.log(`[room:leave] Solicitud recibida de cliente: ${socket.id}`)

      const { roomCode, playerId } = payload

      if (!roomCode) {
        throw new Error('El código de la sala es requerido')
      }

      if (!playerId) {
        throw new Error('El ID del jugador es requerido')
      }

      // PASO 1: Llamar al servicio que remueve el jugador de la sala
      const { room, wasDeleted, newHostId } = await leaveRoom(roomCode, playerId)

      console.log(`[room:leave] Jugador ${playerId} salió de la sala ${roomCode}`)

      // PASO 1.5: Actualizar la sala actual del jugador en Redis (poner en null)
      await updatePlayerRoom(playerId, null)

      // PASO 2: Remover el socket de la sala de Socket.IO
      socket.leave(roomCode)
      console.log(`[room:leave] Socket ${socket.id} removido de la sala ${roomCode}`)

      // Limpiar referencia de la sala en el socket
      delete socket.data.roomCode
      delete socket.data.playerId

      // PASO 3: Si la sala fue eliminada, solo responder al callback
      if (wasDeleted) {
        if (callback) {
          callback({ success: true, wasDeleted: true })
        }
        console.log(`[room:leave] Sala ${roomCode} eliminada`)
        return
      }

      // PASO 4: Si la sala aún existe, notificar a los jugadores restantes
      if (room) {
        socket.to(roomCode).emit('room:updated', { room })
        console.log(`[room:leave] Evento room:updated enviado a sala ${roomCode}`)
      }

      // PASO 5: Responder al callback
      if (callback) {
        callback({ success: true, wasDeleted: false })
      }

      console.log(`[room:leave] Respuesta enviada al cliente ${socket.id}`)
    } catch (error) {
      // MANEJO DE ERRORES
      console.error(`[room:leave] Error:`, error)

      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

      // Emitir evento de error al cliente
      socket.emit('error', {
        message: `Error al salir de la sala: ${errorMessage}`,
        code: 'LEAVE_ROOM_ERROR',
      })

      // Responder también en el callback si existe
      if (callback) {
        callback({
          success: false,
          error: errorMessage,
        })
      }
    }
  })

  // ============================================
  // EVENTO: disconnect
  // ============================================
  // Se ejecuta cuando el cliente se desconecta
  // Si estaba en una sala, automáticamente lo remueve
  socket.on('disconnect', async (reason) => {
    console.log(`[Socket] Cliente desconectado: ${socket.id}, razón: ${reason}`)

    // Si el socket estaba en una sala, removerlo automáticamente
    const { roomCode, playerId } = socket.data

    if (roomCode && playerId) {
      try {
        console.log(`[disconnect] Removiendo jugador ${playerId} de sala ${roomCode}`)
        const { room, wasDeleted } = await leaveRoom(roomCode, playerId)

        // Actualizar la sala actual del jugador en Redis
        await updatePlayerRoom(playerId, null)

        if (!wasDeleted && room) {
          // Notificar a los jugadores restantes
          socket.to(roomCode).emit('room:updated', { room })
          console.log(`[disconnect] Sala ${roomCode} actualizada tras desconexión`)
        } else if (wasDeleted) {
          console.log(`[disconnect] Sala ${roomCode} eliminada tras desconexión`)
        }
      } catch (error) {
        console.error(`[disconnect] Error al remover jugador de sala:`, error)
      }
    }
  })
}