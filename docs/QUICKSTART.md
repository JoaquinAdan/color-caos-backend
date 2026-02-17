# 🚀 Cómo Probar Socket.IO + Redis

## Paso 1: Iniciar el Servidor

```bash
npm run dev
```

Deberías ver:
```
Server is running on http://localhost:4000
[Socket.IO] Servidor inicializado
```

## Paso 2: Abrir el Cliente de Prueba

Abre en tu navegador:
```
file:///ruta/a/color-caos-backend/docs/test-client.html
```

O usa Live Server de VS Code (clic derecho → Open with Live Server).

## Paso 3: Interactuar

1. **Verás**: Estado de conexión en verde ✅
2. **Haz clic** en "Crear Item" 
3. **Observa**: El log mostrará el evento en tiempo real
4. **Repite**: Cada clic crea un item con número incremental

## Paso 4: Verificar en Redis

### Opción A: Redis CLI

```bash
redis-cli -h bright-chipmunk-10015.upstash.io -p 6379 \
  -a AScfAAIncDE0ZDhkYzU1MDc3NDc0MjZmOTEzZWI5YThkOWJlYjY4NXAxMTAwMTU

# Ver items
KEYS item-*

# Ver TTL de un item
TTL item-1
```

### Opción B: Script Node.js

Crea `check.js`:
```javascript
const { Redis } = require('@upstash/redis')
require('dotenv/config')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

async function check() {
  const keys = await redis.keys('item-*')
  console.log('Items:', keys)
  
  for (const key of keys) {
    const ttl = await redis.ttl(key)
    console.log(`${key} → TTL: ${ttl}s`)
  }
}

check()
```

Ejecutar:
```bash
node check.js
```

## 📊 Lo que Deberías Ver

### En el Cliente (Browser)
```
✅ Conectado (socket-id-12345)
📡 Solicitud enviada: create-item
✅ Item Creado
  item: item-1
  último: ninguno
  TTL: 60s
  total: 1
```

### En la Consola del Servidor
```
[Socket.IO] Nueva conexión: abc123
[Socket] Cliente conectado: abc123
[create-item] Solicitud recibida de cliente: abc123
[create-item] Item creado exitosamente: {
  createdItem: 'item-1',
  lastCreatedItem: null,
  ttlSeconds: 60,
  existingItemsCount: 0
}
[create-item] Respuesta enviada al cliente abc123
```

### En Redis (después de 60 segundos)
```
# Antes
127.0.0.1:6379> KEYS item-*
1) "item-1"

127.0.0.1:6379> TTL item-1
(integer) 45

# Después de 60s
127.0.0.1:6379> KEYS item-*
(empty array)

127.0.0.1:6379> GET item-1
(nil)
```

## 🎯 Flujo Resumido

```
Cliente              Socket.IO            Redis
  │                     │                   │
  ├── emit('create-item')                   │
  │                     │                   │
  │                     ├── keys('item-*') ─┤
  │                     │                   │
  │                     │← ['item-1']       │
  │                     │                   │
  │                     ├── set('item-2')  ─┤
  │                     │    TTL: 60s       │
  │                     │                   │
  │← emit('item-created')                   │
  │    {item: 'item-2'}                     │
  │                                         │
```

## 📚 Documentación Completa

Lee el tutorial completo en:
- [docs/SOCKET_REDIS_TUTORIAL.md](./SOCKET_REDIS_TUTORIAL.md)

## 🐛 Errores Comunes

### "Redis connection refused"
→ Verifica tu `.env` tiene las variables correctas

### "Socket.IO not connecting"  
→ Asegúrate que el servidor esté corriendo en `http://localhost:4000`

### "Items no expiran"
→ Espera 60 segundos completos y verifica con `redis-cli TTL item-1`

## ✨ Tips

- Presiona **ESPACIO** para crear items rápidamente
- Usa **CTRL+C** para limpiar el log
- Abre la consola del navegador (F12) para ver logs detallados
- Abre múltiples pestañas para simular varios clientes
