// Tipos de eventos y payloads de Socket.IO.
// Definir aquí contratos cliente-servidor para tiempo real.

// ============================================
// EVENTOS DEL SERVIDOR AL CLIENTE
// ============================================
export interface ServerToClientEvents {
  // Sistema
  'system:connected': (payload: { ok: boolean }) => void
  
  // Items - Respuesta cuando se crea un item exitosamente
  'item-created': (payload: {
    createdItem: string
    lastCreatedItem: string | null
    ttlSeconds: number
    existingItemsCount: number
  }) => void
  
  // Error genérico
  'error': (payload: { message: string; code?: string }) => void
}

// ============================================
// EVENTOS DEL CLIENTE AL SERVIDOR
// ============================================
export interface ClientToServerEvents {
  // Players (ejemplo para tu juego)
  'player:join': (payload: { roomCode: string; name: string }) => void
  
  // Items - El cliente solicita crear el siguiente item
  'create-item': (callback?: (response: {
    success: boolean
    error?: string
  }) => void) => void
}