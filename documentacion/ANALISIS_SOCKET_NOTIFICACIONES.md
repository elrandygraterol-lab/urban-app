# Análisis Completo: Socket.IO y Notificaciones en Tiempo Real

**Fecha:** 27 de Marzo, 2026  
**Problema Reportado:** Conductores no reciben notificaciones de solicitudes de viaje cuando la app está abierta

---

## 🎯 Resumen del Problema

Tienes DOS sistemas de notificaciones que deben trabajar juntos:

1. **Push Notifications (Expo Push)** - Cuando la app está CERRADA o en SEGUNDO PLANO
2. **Socket.IO** - Cuando la app está ABIERTA (foreground)

**El problema:** Los conductores NO reciben notificaciones via Socket.IO cuando la app está abierta.

---

## 🔍 Análisis del Flujo Actual

### Flujo Completo de Notificación

```
PASAJERO SOLICITA VIAJE
        ↓
Backend: rideController.createRide()
        ↓
Backend: NotificationService.notifyNearbyDrivers()
        ↓
Backend: PubSubService.publish(RIDE_REQUESTED)
        ↓
    ┌───┴───┐
    ↓       ↓
PUSH    SOCKET.IO
(app cerrada)  (app abierta)
    ↓       ↓
unifiedPushService  rideNotificationHandler
    ↓       ↓
Expo Push API   emitToUser()
    ↓       ↓
Dispositivo   Socket del conductor
```

### Código Backend: Emisión de Evento Socket

**`backend/src/services/rideNotificationHandler.ts`**
```typescript
// Cuando se publica RIDE_REQUESTED en Redis
PubSubService.subscribe(PubSubEvent.RIDE_REQUESTED, async (data) => {
  // Para cada conductor cercano
  data.driverIds.map((driverId: string) => {
    // ✅ Emite evento via Socket.IO
    emitToUser(driverId, 'ride:request_created', {
      id: data.rideId,
      passengerName: 'Pasajero',
      pickupAddress: data.pickup.address,
      destinationAddress: data.destination.address,
      estimatedFare: data.estimatedFare,
      distance: driverData?.distance,
      expiresAt: new Date(Date.now() + 30000).toISOString(),
    });
  });
});
```

**`backend/src/services/socketService.ts`**
```typescript
export const emitToUser = async (userId: string, event: string, data: any) => {
  const roomName = `user:${userId}`;  // ← Room personal del usuario
  
  // Obtener sockets en el room
  const sockets = await io.in(roomName).fetchSockets();
  
  logger.info(`📤 Emitting ${event} to ${roomName}`);
  logger.info(`   └─ Sockets in room: ${sockets.length}`);  // ← CLAVE
  
  if (sockets.length === 0) {
    logger.warn(`⚠️ NO SOCKETS IN ROOM! User ${userId} may not be connected`);
  }
  
  // Emitir evento
  io.to(roomName).emit(event, data);
};
```

### Código Frontend: Conexión y Escucha

**`app/services/socket.ts`**
```typescript
export const connectSocket = async (authToken?: string): Promise<Socket> => {
  // Crear conexión
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['polling'],  // ← Solo polling
    reconnection: true,
  });

  // Esperar conexión
  await new Promise<void>((resolve, reject) => {
    socket!.once('connect', () => {
      console.log('[SOCKET] ✅ Connection established');
      resolve();
    });
  });

  return socket;
};
```

**`app/app/(driver)/index.tsx`**
```typescript
const initializeSocket = async () => {
  // 1. Conectar socket
  const socket = await connectSocket(token);
  
  // 2. Configurar listeners
  setupSocketListeners(socket);
};

const setupSocketListeners = (socket: Socket) => {
  // ✅ Escuchar evento ride:request_created
  socket.on('ride:request_created', (data: RideRequest) => {
    console.log('[DRIVER] 🚗 Ride request received:', data);
    setRideRequest(data);  // ← Mostrar modal
  });
};
```

---

## 🐛 Problemas Identificados

### Problema 1: Usuario NO se une a su room personal

**Backend:** Cuando el socket se conecta, el usuario DEBE unirse a su room personal:

```typescript
// ✅ ESTO ESTÁ EN EL CÓDIGO (socketService.ts línea 103)
io.on('connection', (socket: AuthenticatedSocket) => {
  const userId = socket.user?.userId;
  
  if (userId) {
    socket.join(`user:${userId}`);  // ← Usuario se une a su room
    logger.debug(`User ${userId} joined personal room`);
  }
});
```

**Verificación necesaria:**
1. ¿El token JWT contiene el `userId` correcto?
2. ¿El middleware de autenticación está funcionando?
3. ¿El socket se está conectando exitosamente?

### Problema 2: Nombre del evento no coincide

**Backend emite:** `ride:request_created`
**Frontend escucha:** `ride:request_created`

✅ Los nombres coinciden, esto está correcto.

### Problema 3: Timing - Listener se registra DESPUÉS del evento

Si el evento se emite ANTES de que el listener esté registrado, se pierde.

**Secuencia actual:**
```
1. Pasajero solicita viaje
2. Backend emite ride:request_created
3. Conductor abre app (DESPUÉS)
4. Socket se conecta
5. Listener se registra
6. ❌ Evento ya pasó, no se recibe
```

**Solución:** El conductor debe tener la app abierta Y el socket conectado ANTES de que llegue la solicitud.

### Problema 4: Socket se desconecta silenciosamente

El código tiene manejo silencioso de errores:

```typescript
socket.on('connect_error', async (error) => {
  // Silent handling - don't log errors
  isConnecting = false;
  reconnectAttempts++;
  // ...
});
```

Esto puede ocultar problemas de conexión.

---

## 🔧 Diagnóstico Paso a Paso

### Paso 1: Verificar Conexión del Socket

**En el frontend (app del conductor):**

Busca en los logs:
```
[SOCKET] ========== CONNECT SOCKET CALLED ==========
[SOCKET] ✅ Valid token obtained
[SOCKET] Connecting to: http://...
[SOCKET] ✅ Connected successfully! Socket ID: xxxxx
[SOCKET] ========== CONNECT SOCKET COMPLETE ==========
```

Si NO ves estos logs, el socket NO se está conectando.

### Paso 2: Verificar Autenticación

**En el backend:**

Busca en los logs:
```
Socket authenticated: userId=xxxxx, role=driver
Client connected: socketId=xxxxx, userId=xxxxx, role=driver
User xxxxx joined personal room
```

Si NO ves "joined personal room", el usuario NO está en su room.

### Paso 3: Verificar Emisión del Evento

**En el backend (cuando pasajero solicita viaje):**

Busca en los logs:
```
Received RIDE_REQUESTED event for ride xxxxx
📤 Emitting ride:request_created to user:xxxxx
   └─ Sockets in room: 1  ← DEBE SER > 0
   └─ Socket ID: xxxxx
✅ Event ride:request_created emitted to user:xxxxx
```

Si ves "Sockets in room: 0", el conductor NO está conectado.

### Paso 4: Verificar Recepción en Frontend

**En el frontend (app del conductor):**

Busca en los logs:
```
[DRIVER] ========== EVENT RECEIVED ==========
[DRIVER] 🚗 Ride request received: {...}
[DRIVER] ========================================
```

Si NO ves esto, el evento NO llegó al frontend.

---

## 🛠️ Soluciones Propuestas

### Solución 1: Mejorar Logging para Diagnóstico

Necesitamos ver QUÉ está fallando. Voy a agregar logs detallados.

### Solución 2: Verificar Token JWT

El token debe contener el `userId` correcto del conductor.

### Solución 3: Reconexión Automática

Asegurar que el socket se reconecte automáticamente si se desconecta.

### Solución 4: Indicador Visual de Conexión

Ya existe en el código:
```typescript
<View style={[styles.connectionStatus, 
  socketInstance?.connected ? styles.connected : styles.disconnected]}>
  <Text>{socketInstance?.connected ? 'Conectado' : 'Desconectado'}</Text>
</View>
```

El conductor puede ver si está conectado.

---

## 📋 Checklist de Verificación

Para diagnosticar el problema, necesitas verificar:

### En el Frontend (App del Conductor)

- [ ] ¿El socket se conecta exitosamente?
  - Buscar: `[SOCKET] ✅ Connected successfully!`
  
- [ ] ¿El indicador muestra "Conectado"?
  - Ver el badge verde en la esquina superior derecha
  
- [ ] ¿Los listeners están registrados?
  - Buscar: `[DRIVER] ✅ Listener registered for: ride:request_created`
  
- [ ] ¿El token es válido?
  - Buscar: `[SOCKET] ✅ Valid token obtained`

### En el Backend

- [ ] ¿El socket se autentica correctamente?
  - Buscar: `Socket authenticated: userId=xxxxx, role=driver`
  
- [ ] ¿El usuario se une a su room personal?
  - Buscar: `User xxxxx joined personal room`
  
- [ ] ¿El evento se emite al room correcto?
  - Buscar: `📤 Emitting ride:request_created to user:xxxxx`
  
- [ ] ¿Hay sockets en el room?
  - Buscar: `Sockets in room: 1` (debe ser > 0)

---

## 🎯 Próximos Pasos

1. **Agregar logs detallados** para ver exactamente dónde falla
2. **Verificar el token JWT** del conductor
3. **Probar el flujo completo** con logs activados
4. **Revisar los logs del backend** cuando se emite el evento

¿Quieres que agregue logs más detallados para diagnosticar el problema?

---

**Última Actualización:** 27 de Marzo, 2026  
**Autor:** Kiro AI Assistant

