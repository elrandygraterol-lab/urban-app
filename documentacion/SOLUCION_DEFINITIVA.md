# Solución Definitiva - Debugging Socket.io

## 🎯 Problema Identificado

Después de 5+ horas de análisis, el problema NO es Firebase ni notificaciones push.

**El problema real**: Los eventos de Socket.io no están llegando del backend al frontend.

---

## ✅ Cambios Aplicados

### 1. Backend: Logs de Debugging Mejorados

**Archivo**: `backend/src/services/socketService.ts`

**Cambio**: La función `emitToUser()` ahora muestra:
- Cuántos sockets están en la sala del usuario
- Los IDs de cada socket
- Advertencia si NO hay sockets en la sala

**Logs esperados**:
```
📤 Emitting ride:request_created to user:driver-123
   └─ Sockets in room: 1
   └─ Socket ID: RvY7Ub-wWK9nHnUdAAAN
✅ Event ride:request_created emitted to user:driver-123
```

**Si el usuario NO está conectado**:
```
📤 Emitting ride:request_created to user:driver-123
   └─ Sockets in room: 0
   └─ ⚠️ NO SOCKETS IN ROOM! User driver-123 may not be connected
```

---

### 2. Frontend: Logs de Debugging Mejorados

**Archivo**: `app/app/(driver)/index.tsx`

**Cambio**: La función `setupSocketListeners()` ahora muestra:
- Socket ID
- Estado de conexión
- Confirmación de registro de listener
- Evento recibido con datos completos

**Logs esperados**:
```
[DRIVER] ========== SETTING UP LISTENERS ==========
[DRIVER] Socket ID: RvY7Ub-wWK9nHnUdAAAN
[DRIVER] Socket connected: true
[DRIVER] ✅ Listener registered for: ride:request_created
[DRIVER] ==========================================
```

**Cuando llega un evento**:
```
[DRIVER] ========== EVENT RECEIVED ==========
[DRIVER] 🚗 Ride request received: {
  "id": "ride-123",
  "passengerName": "Pasajero",
  "pickupAddress": "...",
  ...
}
[DRIVER] ========================================
```

---

## 🧪 Cómo Probar

### Paso 1: Reiniciar Backend

```bash
cd backend
npm run dev
```

**Verificar que aparezca**:
```
✅ Socket.io server initialized with Redis adapter
Server running on http://0.0.0.0:3000
```

---

### Paso 2: Abrir App como Conductor

1. Abre la app en el dispositivo
2. Inicia sesión como **conductor**
3. Ve al panel de conductor

**Verificar logs en Metro**:
```
[SOCKET] ✅ Connected successfully! Socket ID: xxx
[DRIVER] ========== SETTING UP LISTENERS ==========
[DRIVER] Socket ID: xxx
[DRIVER] Socket connected: true
[DRIVER] ✅ Listener registered for: ride:request_created
```

**Verificar logs en Backend**:
```
Socket authenticated: userId=driver-123, role=driver
Client connected: socketId=xxx, userId=driver-123, role=driver
User driver-123 joined personal room
```

---

### Paso 3: Activar Disponibilidad

1. Activa el toggle de disponibilidad (verde)
2. Verifica que el indicador de conexión esté VERDE

**Verificar logs en Metro**:
```
[DRIVER] Initial location sent: {"latitude": 10.xxx, "longitude": -67.xxx}
```

---

### Paso 4: Solicitar Viaje desde Pasajero

1. En otro dispositivo, abre la app como **pasajero**
2. Selecciona un destino
3. Solicita un viaje

---

### Paso 5: Analizar Logs

#### En el Backend:

**Busca estos logs en orden**:

1. **Ride creado**:
```
[RideController] Ride request created: ride-123 by passenger pass-456
```

2. **Evento publicado a Redis**:
```
[PubSubService] Published RIDE_REQUESTED event
```

3. **Handler recibe evento**:
```
[RideNotificationHandler] Received RIDE_REQUESTED event for ride ride-123
```

4. **Emitiendo a conductor** (CRÍTICO):
```
📤 Emitting ride:request_created to user:driver-123
   └─ Sockets in room: ???  ← ESTE ES EL NÚMERO CLAVE
   └─ Socket ID: xxx
```

**CASOS POSIBLES**:

**Caso A: Sockets in room: 1 o más** ✅
```
📤 Emitting ride:request_created to user:driver-123
   └─ Sockets in room: 1
   └─ Socket ID: RvY7Ub-wWK9nHnUdAAAN
✅ Event ride:request_created emitted to user:driver-123
```
→ El evento SE EMITIÓ correctamente
→ Si el conductor NO lo recibe, el problema está en el FRONTEND

**Caso B: Sockets in room: 0** ❌
```
📤 Emitting ride:request_created to user:driver-123
   └─ Sockets in room: 0
   └─ ⚠️ NO SOCKETS IN ROOM! User driver-123 may not be connected
```
→ El conductor NO está conectado al socket
→ El problema está en la CONEXIÓN

---

#### En el Frontend (Conductor):

**Busca este log**:

**Si aparece**:
```
[DRIVER] ========== EVENT RECEIVED ==========
[DRIVER] 🚗 Ride request received: {...}
```
→ ✅ TODO FUNCIONA! El evento llegó correctamente

**Si NO aparece**:
→ ❌ El evento NO llegó al frontend

---

## 🔍 Diagnóstico Según Logs

### Escenario 1: Backend dice "Sockets in room: 0"

**Problema**: El conductor no está conectado al socket.

**Posibles causas**:
1. El token JWT es inválido o expiró
2. El `userId` en el token no coincide con el `userId` del conductor
3. El socket se desconectó antes de que llegara el evento

**Solución**:
```bash
# En el backend, agregar log en la autenticación
# backend/src/services/socketService.ts, línea ~75

logger.info(`Socket authenticated: userId=${decoded.userId}, role=${decoded.role}`);
logger.info(`Token payload:`, decoded);  // ← AGREGAR ESTO
```

Luego verifica que el `userId` en el token coincida con el `userId` del conductor en la DB.

---

### Escenario 2: Backend dice "Sockets in room: 1" pero frontend NO recibe

**Problema**: El evento se emite pero el listener no lo captura.

**Posibles causas**:
1. El nombre del evento no coincide exactamente
2. El listener se registró DESPUÉS de que llegó el evento (race condition)
3. Hay un error en el callback del listener que lo hace fallar silenciosamente

**Solución**:
```typescript
// En app/app/(driver)/index.tsx
socket.on('ride:request_created', (data: RideRequest) => {
  try {
    console.log('[DRIVER] ========== EVENT RECEIVED ==========');
    console.log('[DRIVER] Raw data:', data);
    console.log('[DRIVER] Data type:', typeof data);
    console.log('[DRIVER] Data keys:', Object.keys(data));
    
    setRideRequest(data);
    // ... resto del código
  } catch (error) {
    console.error('[DRIVER] ❌ Error in listener:', error);
  }
});
```

---

### Escenario 3: Backend dice "Sockets in room: 1" y frontend recibe

**Problema**: ¡NO HAY PROBLEMA! Todo funciona.

**Acción**: Continuar con las pruebas de notificaciones push para cuando la app esté cerrada.

---

## 📋 Checklist de Verificación

Cuando pruebes, marca cada item:

### Backend:
- [ ] "Socket.io server initialized" aparece al iniciar
- [ ] "Socket authenticated: userId=X" aparece cuando conductor abre app
- [ ] "User X joined personal room" aparece
- [ ] "Ride request created" aparece cuando pasajero solicita
- [ ] "Published RIDE_REQUESTED event" aparece
- [ ] "Received RIDE_REQUESTED event" aparece
- [ ] "📤 Emitting ride:request_created to user:X" aparece
- [ ] "Sockets in room: 1" (o más) aparece ← **CRÍTICO**
- [ ] "Socket ID: xxx" aparece

### Frontend (Conductor):
- [ ] "[SOCKET] ✅ Connected successfully" aparece
- [ ] "[DRIVER] Socket ID: xxx" aparece
- [ ] "[DRIVER] Socket connected: true" aparece
- [ ] "[DRIVER] ✅ Listener registered" aparece
- [ ] "[DRIVER] Initial location sent" aparece
- [ ] Indicador de conexión está VERDE
- [ ] "[DRIVER] ========== EVENT RECEIVED ==========" aparece ← **CRÍTICO**

---

## 🚨 Si Sigue Sin Funcionar

Si después de verificar TODOS los logs, el problema persiste:

### Opción 1: Verificar userId en el token

```bash
# En el backend, agregar este log temporal
# backend/src/services/socketService.ts

socket.on('connection', (socket: AuthenticatedSocket) => {
  const userId = socket.user?.userId;
  
  console.log('========== NEW CONNECTION ==========');
  console.log('Socket ID:', socket.id);
  console.log('User ID:', userId);
  console.log('User Role:', socket.user?.role);
  console.log('User Email:', socket.user?.email);
  console.log('====================================');
  
  // ... resto del código
});
```

Luego verifica que el `userId` sea correcto.

### Opción 2: Emitir a TODOS los sockets (test)

```typescript
// En backend/src/services/rideNotificationHandler.ts
// TEMPORAL - solo para debugging

// En lugar de:
emitToUser(driverId, 'ride:request_created', data);

// Usar:
const io = getSocketServer();
io.emit('ride:request_created', data);  // ← Emite a TODOS
logger.info('Emitted to ALL sockets (test)');
```

Si esto funciona, confirma que el problema es con las salas de Socket.io.

### Opción 3: Usar polling en lugar de websocket

```typescript
// En app/services/socket.ts

socket = io(SOCKET_URL, {
  auth: { token },
  transports: ['polling'],  // ← Solo polling, no websocket
  // ... resto de opciones
});
```

Si esto funciona, el problema es con la conexión websocket.

---

## 💡 Conclusión

Con estos logs detallados, podremos identificar EXACTAMENTE dónde falla el flujo:

1. ¿El conductor está conectado? → Verificar "Sockets in room"
2. ¿El evento se emite? → Verificar "📤 Emitting"
3. ¿El evento llega? → Verificar "EVENT RECEIVED"

**NO hagas un nuevo build todavía**. Primero necesitamos ver estos logs para entender qué está pasando.

---

## 📞 Próximos Pasos

1. **Reinicia el backend** con los nuevos logs
2. **Abre la app** como conductor (no necesitas nuevo build)
3. **Solicita un viaje** desde pasajero
4. **Copia TODOS los logs** del backend y frontend
5. **Analiza** según los escenarios arriba

Con esta información, sabremos exactamente cuál es el problema real.

---

**Fecha**: 27 de Marzo, 2026  
**Estado**: Debugging tools implementados  
**Próximo paso**: Probar y analizar logs
