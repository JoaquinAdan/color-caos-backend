# color-caos-backend

Backend en **Node.js + Express + TypeScript + Socket.IO** para juego multijugador en tiempo real.

## Arquitectura Modular (Feature-Based)

La estructura separa responsabilidades por dominio:

```
src/
├── config/               # Configuración global
│   ├── env.ts           # Variables de entorno centralizadas
│   └── redis.ts         # Cliente Redis compartido
│
├── modules/             # Lógica de negocio por dominio
│   ├── players/         # Gestión de jugadores
│   │   ├── player.types.ts
│   │   └── player.service.ts
│   ├── rooms/           # Gestión de salas
│   │   ├── room.types.ts
│   │   ├── room.service.ts
│   │   └── room.validators.ts
│   └── game/            # Lógica del juego
│       ├── game.service.ts
│       ├── round.service.ts
│       └── game.utils.ts
│
├── socket/              # Capa de tiempo real
│   ├── socket.types.ts  # Contratos de eventos Socket.IO
│   ├── socket.events.ts # Registro de handlers por conexión
│   └── socket.server.ts # Inicialización de Socket.IO
│
├── http/                # Capa HTTP REST
│   └── health.route.ts  # Rutas básicas (health, status)
│
├── app.ts               # Composición de Express (middlewares + rutas)
└── index.ts             # Punto de entrada (inicia HTTP + Socket.IO)
```

## Flujo de Arranque

1. **index.ts**: Crea servidor HTTP, monta Socket.IO y levanta servidor
2. **app.ts**: Configura Express (JSON, rutas `/api/health`)
3. **socket.server.ts**: Inicializa Socket.IO y registra listeners
4. **socket.events.ts**: Conecta eventos a servicios de dominio (players, rooms, game)

## Responsabilidades

| Módulo       | Responsabilidad                                     |
|--------------|-----------------------------------------------------|
| `config/`    | Variables de entorno, clientes externos (Redis)     |
| `modules/`   | Lógica pura de negocio (sin HTTP/Socket mezcla)    |
| `socket/`    | Eventos tiempo real, mapeo a servicios de dominio   |
| `http/`      | Rutas REST (health, admin, debug opcional)          |
| `app.ts`     | Registro de middlewares globales                    |
| `index.ts`   | Bootstrap del servidor                              |

## Estado Actual

✅ Estructura base con exports placeholder  
✅ TypeScript compila sin errores  
⏳ Lógica de negocio pendiente de implementación  

## Scripts Disponibles

```bash
npm run dev          # Servidor con hot-reload (nodemon)
npm run build        # Compila TypeScript a dist/
npm start            # Ejecuta versión compilada
npm run type-check   # Verifica tipos sin compilar
```

## Próximos Pasos

1. Implementar servicios de dominio (players, rooms, game)
2. Conectar eventos Socket.IO a lógica del juego
3. Persistir estado en Redis
4. Agregar validaciones y manejo de errores
5. Configurar tests unitarios e integración