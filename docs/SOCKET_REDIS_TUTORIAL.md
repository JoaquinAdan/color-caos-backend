# Tutorial: Socket.IO + Redis - Crear Items Incrementales

Este tutorial te enseña paso a paso cómo funciona un evento de Socket.IO que interactúa con Redis.

## 📋 Índice

1. [Flujo Completo](#flujo-completo)
2. [Código Explicado](#código-explicado)
3. [Cómo Probarlo](#cómo-probarlo)
4. [Verificar TTL en Redis](#verificar-ttl-en-redis)
5. [Troubleshooting](#troubleshooting)

---

## 🔄 Flujo Completo

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Cliente   │         │  Socket.IO  │         │   Backend   │         │    Redis    │
│  (Browser)  │         │   Server    │         │  (Service)  │         │   (Cache)   │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │                       │
       │  1. emit('create-item')                       │                       │
       │──────────────────────>│                       │                       │
       │                       │                       │                       │
       │                       │  2. registerSocketEvents()                    │
       │                       │      on('create-item')                        │
       │                       │──────────────────────>│                       │
       │                       │                       │                       │
       │                       │                       │  3. redis.keys('item-*')
       │                       │                       │──────────────────────>│
       │                       │                       │                       │
       │                       │                       │  4. ['item-1', 'item-2']
       │                       │                       │<──────────────────────│
       │                       │                       │                       │
       │                       │                       │  5. Calcular siguiente
       │                       │                       │     (último es item-2)
       │                       │                       │     → crear item-3    │
       │                       │                       │                       │
       │                       │                       │  6. redis.set('item-3', 'item-3', {ex: 60})
       │                       │                       │──────────────────────>│
       │                       │                       │                       │
       │                       │                       │  7. OK                │
       │                       │                       │<──────────────────────│
       │                       │                       │                       │
       │                       │  8. Retorna resultado │                       │
       │                       │<──────────────────────│                       │
       │                       │                       │                       │
       │  9. emit('item-created', {createdItem: 'item-3', ...})               │
       │<──────────────────────│                       │                       │
       │                       │                       │                       │
       │  ✅ UI actualizado    │                       │                       │
       │                       │                       │                       │
```

**Tiempo aproximado: 10-50ms** (dependiendo de latencia de Redis)

---

## 💻 Código Explicado

### 1️⃣ **Definición de Tipos** (`socket.types.ts`)

```typescript
// Define el CONTRATO entre cliente y servidor
export interface ClientToServerEvents {
  'create-item': (callback?: (response: {
    success: boolean
    error?: string
  }) => void) => void
}

export interface ServerToClientEvents {
  'item-created': (payload: {
    createdItem: string
    lastCreatedItem: string | null
    ttlSeconds: number
    existingItemsCount: number
  }) => void
}
```

**¿Para qué sirve esto?**
- TypeScript te ayudará a autocompletar eventos
- No podrás enviar eventos que no existen
- Los payloads estarán tipados

---

### 2️⃣ **Servicio de Redis** (`item.service.ts`)

```typescript
export const createNextItem = async () => {
  // PASO 1: Obtener todas las claves que empiecen con "item-"
  const itemKeys = await redis.keys(`${ITEM_KEY_PREFIX}*`)
  // Ejemplo: ['item-1', 'item-5', 'item-3']

  // PASO 2: Extraer el número de cada item
  const numberedItems = itemKeys
    .map((itemKey) => ({
      key: itemKey,
      number: getItemNumber(itemKey), // Extrae el "5" de "item-5"
    }))
    .filter((item) => item.number !== null)
    .sort((a, b) => b.number - a.number) // Ordenar descendente

  // PASO 3: Calcular siguiente número
  const nextItemNumber = numberedItems.length > 0 
    ? numberedItems[0].number + 1  // Si hay items → último + 1
    : 1                              // Si no hay → empezar en 1

  const newItem = `item-${nextItemNumber}`

  // PASO 4: Guardar en Redis con TTL de 60 segundos
  await redis.set(newItem, newItem, { ex: ITEM_TTL_SECONDS })

  // PASO 5: Retornar metadata útil
  return {
    createdItem: newItem,
    lastCreatedItem: numberedItems[0]?.key || null,
    ttlSeconds: ITEM_TTL_SECONDS,
    existingItemsCount: numberedItems.length,
  }
}
```

**¿Qué hace Redis aquí?**
- `redis.keys('item-*')`: Busca todas las claves que coincidan con el patrón
- `redis.set(key, value, {ex: 60})`: Guarda un valor que expira en 60 segundos

---

### 3️⃣ **Handler del Evento** (`socket.events.ts`)

```typescript
socket.on('create-item', async (callback) => {
  try {
    // 1. Llamar al servicio (este maneja Redis)
    const result = await createNextItem()

    // 2. Emitir respuesta al cliente que lo pidió
    socket.emit('item-created', {
      createdItem: result.createdItem,
      lastCreatedItem: result.lastCreatedItem,
      ttlSeconds: result.ttlSeconds,
      existingItemsCount: result.existingItemsCount,
    })

    // 3. Confirmar en el callback (opcional, pero recomendado)
    if (callback) {
      callback({ success: true })
    }

  } catch (error) {
    // Manejo de errores
    socket.emit('error', {
      message: `Error al crear item: ${error.message}`,
      code: 'CREATE_ITEM_ERROR',
    })

    if (callback) {
      callback({ success: false, error: error.message })
    }
  }
})
```

**¿Por qué usar callback?**
- Los callbacks te dan **confirmación inmediata**
- Útil para saber si la operación fue exitosa antes de actualizar la UI

---

### 4️⃣ **Inicialización de Socket.IO** (`socket.server.ts`)

```typescript
export const createSocketServer = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // En producción: 'https://tudominio.com'
      methods: ['GET', 'POST'],
    },
  })

  // Cada vez que un cliente se conecta
  io.on('connection', (socket) => {
    console.log(`Nueva conexión: ${socket.id}`)

    // Registrar eventos personalizados
    registerSocketEvents(socket)

    // Confirmar conexión
    socket.emit('system:connected', { ok: true })
  })

  return io
}
```

**¿Qué es `socket.id`?**
- ID único generado por Socket.IO para cada cliente conectado
- Útil para debugging y logging

---

## 🧪 Cómo Probarlo

### Opción 1: Cliente HTML Simple

Crea un archivo `test-socket.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Test Socket.IO</title>
  <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
</head>
<body>
  <h1>Socket.IO + Redis Test</h1>
  <button id="createBtn">Crear Item</button>
  <div id="output"></div>

  <script>
    // 1. Conectar al servidor
    const socket = io('http://localhost:4000')

    // 2. Escuchar evento de conexión
    socket.on('system:connected', (data) => {
      console.log('✅ Conectado al servidor:', data)
      document.getElementById('output').innerHTML += '<p>✅ Conectado</p>'
    })

    // 3. Escuchar respuesta de item creado
    socket.on('item-created', (data) => {
      console.log('🎉 Item creado:', data)
      document.getElementById('output').innerHTML += `
        <p>
          <strong>Item creado:</strong> ${data.createdItem}<br>
          <strong>Último item:</strong> ${data.lastCreatedItem || 'ninguno'}<br>
          <strong>TTL:</strong> ${data.ttlSeconds} segundos<br>
          <strong>Total items:</strong> ${data.existingItemsCount}
        </p>
      `
    })

    // 4. Escuchar errores
    socket.on('error', (data) => {
      console.error('❌ Error:', data)
      document.getElementById('output').innerHTML += `<p style="color:red">❌ ${data.message}</p>`
    })

    // 5. Botón para crear item
    document.getElementById('createBtn').addEventListener('click', () => {
      socket.emit('create-item', (response) => {
        console.log('Respuesta del callback:', response)
        if (!response.success) {
          alert('Error: ' + response.error)
        }
      })
    })
  </script>
</body>
</html>
```

**Pasos para usar:**

1. Inicia el servidor: `npm run dev`
2. Abre `test-socket.html` en tu navegador
3. Haz clic en "Crear Item" varias veces
4. Observa cómo se incrementan los números

---

### Opción 2: Cliente Node.js

Crea `test-client.js`:

```javascript
const io = require('socket.io-client')

const socket = io('http://localhost:4000')

socket.on('connect', () => {
  console.log('✅ Conectado al servidor')

  // Crear 5 items
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      socket.emit('create-item', (response) => {
        console.log(`Item ${i + 1} →`, response)
      })
    }, i * 1000) // Esperar 1 segundo entre cada uno
  }
})

socket.on('item-created', (data) => {
  console.log('🎉 Recibido:', data)
})

socket.on('error', (data) => {
  console.error('❌ Error:', data)
})
```

**Ejecutar:**

```bash
node test-client.js
```

---

## 🔍 Verificar TTL en Redis

### Opción 1: Redis CLI

```bash
# Conectarse a Redis (Upstash o local)
redis-cli -h bright-chipmunk-10015.upstash.io -p 6379 -a TU_TOKEN

# Ver todas las claves
KEYS item-*

# Ver el valor de un item
GET item-1

# Ver cuánto tiempo queda antes de expirar (en segundos)
TTL item-1
```

**Salida esperada:**

```
127.0.0.1:6379> TTL item-1
(integer) 45    ← Le quedan 45 segundos

# Esperar 60 segundos...

127.0.0.1:6379> TTL item-1
(integer) -2    ← Ya expiró (no existe)

127.0.0.1:6379> GET item-1
(nil)           ← Confirmación: no existe
```

---

### Opción 2: Desde Node.js

Crea `check-redis.js`:

```javascript
const { Redis } = require('@upstash/redis')
require('dotenv/config')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

async function checkItems() {
  const keys = await redis.keys('item-*')
  console.log('Items existentes:', keys)

  for (const key of keys) {
    const ttl = await redis.ttl(key)
    const value = await redis.get(key)
    console.log(`${key}: valor="${value}", TTL=${ttl}s`)
  }
}

checkItems()
```

**Ejecutar:**

```bash
node check-redis.js
```

---

## ⚠️ Troubleshooting

### Error: "Redis connection refused"

**Problema:** No se puede conectar a Redis.

**Solución:**

1. Verifica que tu `.env` tenga las variables correctas:
   ```
   UPSTASH_REDIS_REST_URL=https://bright-chipmunk-10015.upstash.io
   UPSTASH_REDIS_REST_TOKEN=tu_token_aqui
   ```

2. Comprueba conectividad:
   ```bash
   curl https://bright-chipmunk-10015.upstash.io
   ```

---

### Error: "Socket.IO not connecting"

**Problema:** El cliente no se conecta al servidor.

**Solución:**

1. Verifica que el servidor esté corriendo:
   ```bash
   npm run dev
   ```

2. Comprueba el puerto en `.env`:
   ```
   PORT=4000
   ```

3. Asegúrate de usar el puerto correcto en el cliente:
   ```javascript
   const socket = io('http://localhost:4000') // ← Puerto correcto
   ```

---

### Los items no expiran

**Problema:** Los items siguen en Redis después de 60 segundos.

**Solución:**

1. Verifica que estés usando `ex` (segundos) y no `px` (milisegundos):
   ```typescript
   await redis.set(newItem, newItem, { ex: 60 }) // ✅ Correcto
   ```

2. Comprueba manualmente el TTL:
   ```bash
   redis-cli TTL item-1
   ```

---

## 🎓 Conceptos Clave

### ¿Qué es Socket.IO?

Es una librería que permite **comunicación bidireccional en tiempo real** entre cliente y servidor.

**Ventajas:**
- Comunicación instantánea (sin polling)
- Reconexión automática
- Fallback a HTTP long-polling si WebSockets no están disponibles

---

### ¿Qué es Redis?

Es una **base de datos en memoria** ultra-rápida que funciona como caché.

**Ventajas:**
- Operaciones en microsegundos
- TTL (Time To Live) automático
- Estructuras de datos avanzadas (listas, sets, hashes)

---

### ¿Por qué usar TTL?

El TTL (Time To Live) **elimina datos automáticamente** después de X segundos.

**Casos de uso:**
- Sesiones temporales
- Códigos de verificación
- Carritos abandonados
- **Items de juego efímeros** ← Tu caso

---

## 📚 Recursos Adicionales

- [Documentación oficial Socket.IO](https://socket.io/docs/v4/)
- [Documentación Upstash Redis](https://docs.upstash.com/redis)
- [Redis Commands Reference](https://redis.io/commands/)

---

## ✅ Resumen

1. **Cliente** emite `create-item`
2. **Socket.IO** recibe el evento en el servidor
3. **Backend** llama al servicio `createNextItem()`
4. **Servicio** consulta Redis, calcula siguiente número, guarda con TTL
5. **Backend** emite `item-created` de vuelta al cliente
6. **Cliente** actualiza su UI con el nuevo item
7. **Redis** elimina el item automáticamente después de 60 segundos

🎉 **¡Ahora entiendes el flujo completo de Socket.IO + Redis!**
