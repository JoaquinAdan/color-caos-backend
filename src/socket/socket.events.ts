import type { Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from './socket.types'
import { createNextItem } from '../services/item.service'

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
  // EVENTO: create-item
  // ============================================
  // FLUJO COMPLETO:
  // 1. Cliente emite 'create-item'
  // 2. Backend recibe el evento aquí
  // 3. Llama al servicio que consulta Redis
  // 4. Redis responde con los items existentes
  // 5. Servicio calcula el siguiente número
  // 6. Guarda en Redis con TTL de 60 segundos
  // 7. Backend emite 'item-created' de vuelta al cliente
  // ============================================
  
  socket.on('create-item', async (callback) => {
    try {
      console.log(`[create-item] Solicitud recibida de cliente: ${socket.id}`)

      // PASO 1: Llamar al servicio que maneja la lógica de Redis
      // Este servicio está en src/services/item.service.ts
      const result = await createNextItem()

      console.log(`[create-item] Item creado exitosamente:`, result)

      // PASO 2: Emitir evento al cliente con el resultado
      // Esto envía la respuesta en tiempo real
      socket.emit('item-created', {
        createdItem: result.createdItem,
        lastCreatedItem: result.lastCreatedItem,
        ttlSeconds: result.ttlSeconds,
        existingItemsCount: result.existingItemsCount,
      })

      // PASO 3: Si el cliente envió un callback, responder también por ahí
      // Los callbacks son útiles para conocer si la operación fue exitosa
      if (callback) {
        callback({ success: true })
      }

      console.log(`[create-item] Respuesta enviada al cliente ${socket.id}`)
    } catch (error) {
      // MANEJO DE ERRORES
      // Si algo falla (Redis caído, error de red, etc.)
      console.error(`[create-item] Error:`, error)

      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

      // Emitir evento de error al cliente
      socket.emit('error', {
        message: `Error al crear item: ${errorMessage}`,
        code: 'CREATE_ITEM_ERROR',
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
  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Cliente desconectado: ${socket.id}, razón: ${reason}`)
  })
}