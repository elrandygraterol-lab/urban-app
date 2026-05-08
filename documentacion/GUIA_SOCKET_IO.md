# Guía Completa: Socket.IO en Tu Proyecto

## ¿Qué es Socket.IO?

Socket.IO es una biblioteca que permite **comunicación en tiempo real bidireccional** entre el cliente (app móvil) y el servidor (backend). A diferencia de las peticiones HTTP normales (que son request-response), Socket.IO mantiene una conexión persistente que permite:

- **Servidor → Cliente**: El servidor puede enviar datos al cliente en cualquier momento
- **Cliente → Servidor**: El cliente puede enviar datos al servidor en cualquier momento
- **Tiempo Real**: Los datos se transmiten instantáneamente sin necesidad de hacer polling

---

## ¿Para Qué Se Usa Socket.IO en Tu Proyecto?

En tu app de taxis, Socket.IO se usa para **tracking en tiempo real** de viajes:

### 1. Notificaciones de Viajes (Conductor)
```
Pasajero solicita viaje
    ↓
Backend crea viaje en BD
    ↓
Backend emite evento via Socket.IO
    ↓
Conductor recibe notificación INSTANTÁNEA
    ↓
Conductor ve solicitud en su app
```

### 2. Actualización de Estado del Viaje (Pasajero)
```
Conductor acepta viaje
    ↓
Backend actualiza estado en BD
    ↓
Backend emite evento via Socket.IO
    ↓
Pasajero recibe notificación INSTANTÁNEA
    ↓
Pasajero ve "Conductor asignado"
```

### 3. Tracking de Ubicación en Tiempo Real
```
Conductor se mueve
    ↓
App del conductor envía ubicación via Socket.IO
    ↓
Backend recibe ubicación
    ↓
Backend emite ubicación via Socket.IO
    ↓
Pasajero ve ubicación del conductor en el mapa EN TIEMPO REAL
```

### 4. Actualizaciones de ETA (Tiempo Estimado de Llegada)
```
Backend calcula ETA cada X segundos
    ↓
Backend emite ETA via Socket.IO
    ↓
Pasajero ve "Conductor llegará en 5 minutos"
    ↓
ETA se actualiza automáticamente
```

---

## Eventos Socket.IO en Tu Proyecto

### Eventos que Escucha el Pasajero

| Evento | Descripción | Cuándo se Emite |
|--------|-------------|-----------------|
| `ride:accepted` | Conductor aceptó el viaje | Cuando conductor presiona "Aceptar" |
| `ride:status_changed` | Estado del viaje cambió | Cuando conductor llega, inicia viaje, etc. |
| `driver:location_update` | Ubicación del conductor | Cada X segundos mientras conductor se mueve |
| `ride:eta_update` | ETA actualizado | Cada X segundos |
| `ride:cancelled` | Viaje cancelado | Cuando conductor o sistema cancela |

### Eventos que Escucha el Conductor

| Evento | Descripción | Cuándo se Emite |
|--------|-------------|-----------------|
| `ride:request_created` | Nueva solicitud de viaje | Cuando pasajero solicita viaje |
| `ride:cancelled` | Viaje cancelado | Cuando pasajero cancela |

### Eventos que Emite el Cliente

| Evento | Quién lo Emite | Descripción |
|--------|----------------|-------------|
| `join_ride` | Pasajero/Conductor | Unirse a sala de viaje específico |
| `leave_ride` | Pasajero/Conductor | Salir de sala de viaje |
| `driver:update_location` | Conductor | Enviar ubicación actual |

---

## Flujo Completo de un Viaje con Socket.IO

```
1. SOLICITUD DE VIAJE
   Pasajero: HTTP POST /api/rides (crear viaje)
   Backend: Guarda en BD
   Backend: Socket.IO emit 'ride:request_created' → Conductores cercanos
   Conductor: Recibe notificación en tiempo real

2. ACEPTACIÓN DE VIAJE
   Conductor: HTTP POST /api/rides/:id/accept
   Backend: Actualiza BD
   Backend: Socket.IO emit 'ride:accepted' → Pasajero
   Pasajero: Ve "Conductor asignado" instantáneamente

3. TRACKING EN TIEMPO REAL
   Conductor: Socket.IO emit 'driver:update_location' cada 5 segundos
   Backend: Recibe ubicación
   Backend: Socket.IO emit 'driver:location_update' → Pasajero
   Pasajero: Ve conductor moviéndose en el mapa

4. LLEGADA DEL CONDUCTOR
   Conductor: HTTP POST /api/rides/:id/arrive
   Backend: Actualiza BD
   Backend: Socket.IO emit 'ride:status_changed' → Pasajero
   Pasajero: Ve "Conductor ha llegado"

5. INICIO DEL VIAJE
   Conductor: HTTP POST /api/rides/:id/start
   Backend: Actualiza BD
   Backend: Socket.IO emit 'ride:status_changed' → Pasajero
   Pasajero: Ve "Viaje en progreso"

6. FINALIZACIÓN DEL VIAJE
   Conductor: HTTP POST /api/rides/:id/complete
   Backend: Actualiza BD
   Backend: Socket.IO emit 'ride:status_changed' → Pasajero
   Pasajero: Ve pantalla de pago
```

---

## Arquitectura Socket.IO en Tu Proyecto

### Backend (Node.js + Socket.IO)

**Archivo**: `backend/src/services/socketService.ts`

```typescript
// Inicialización
io = new Server(httpServer, {
  cors: socketCorsOptions,
  transports: ['websocket', 'polling'],
});

// Autenticación (REQUIERE JWT)
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('No token provided'));
  }
  const decoded = jwt.verify(token, config.jwtSecret);
  socket.user = decoded;
  next();
});

// Conexión
io.on('connection', (socket) => {
  // Usuario conectado
  socket.join(`user:${socket.user.userId}`);
  
  // Escuchar eventos del cliente
  socket.on('driver:update_location', (data) => {
    // Procesar ubicación
  });
});

// Emitir eventos
io.to(`user:${userId}`).emit('ride:accepted', data);
```

### Frontend (React Native + Socket.IO Client)

**Archivo**: `app/services/socket.ts`

```typescript
// Conectar con token
export const connectSocket = async (authToken?: string) => {
  const token = authToken || await SecureStore.getItemAsync(TOKEN_KEY);
  
  socket = io(SOCKET_URL, {
    auth: { token }, // ← Token JWT para autenticación
    transports: ['websocket', 'polling'],
  });
  
  return socket;
};

// Escuchar eventos
export const onRideAccepted = (callback) => {
  socket.on('ride:accepted', callback);
};

// Emitir eventos
export const joinRide = (rideId) => {
  socket.emit('join_ride', { rideId });
};
```

---

## Problema que Teníamos y Cómo lo Solucionamos

### Problema: Race Condition

```
1. Login exitoso → Token guardado en SecureStore (asíncrono)
2. Estado actualizado → isAuthenticated = true (síncrono)
3. useEffect detecta cambio → Intenta conectar socket
4. Socket lee token de SecureStore → Token AÚN NO ESTÁ GUARDADO
5. Socket falla: "No authentication token found" ❌
```

### Solución: Pasar Token Directamente

```typescript
// ANTES (Incorrecto)
await connectSocket(); // Lee token de SecureStore (race condition)

// AHORA (Correcto)
await connectSocket(token); // Usa token directamente del estado
```

**Cambios Realizados**:

1. **authStore.ts**: Login ahora guarda token en el estado además de SecureStore
   ```typescript
   set({ user, token, isAuthenticated: true });
   ```

2. **socket.ts**: `connectSocket()` acepta token opcional
   ```typescript
   export const connectSocket = async (authToken?: string)
   ```

3. **Pantallas**: Pasan token directamente
   ```typescript
   const { user, token } = useAuthStore();
   await connectSocket(token);
   ```

---

## Logs Detallados Agregados

### Socket Service
```
[SOCKET] No token provided, reading from SecureStore...
[SOCKET] Token found, creating socket connection...
[SOCKET] Connecting to: http://192.168.1.200:3000
[SOCKET] ✅ Connected successfully! Socket ID: abc123
```

### Passenger Screen
```
[PASSENGER] User not authenticated or no token, skipping socket connection
[PASSENGER] Connecting socket with token...
[PASSENGER] ✅ WebSocket connected
```

### Driver Screen
```
[DRIVER] User not authenticated or no token, skipping socket connection
[DRIVER] Connecting socket with token...
[DRIVER] ✅ Socket connected successfully
```

---

## Verificación en Backend

Cuando el socket se conecta correctamente, el backend debe mostrar:

```
[info]: Socket authenticated: userId=d5ad086d-0c69-411c-aecd-8879d6759a54, role=passenger
[info]: Client connected: socketId=abc123, userId=d5ad086d-0c69-411c-aecd-8879d6759a54, role=passenger
[debug]: User d5ad086d-0c69-411c-aecd-8879d6759a54 joined personal room
```

---

## Resumen

### ¿Qué es Socket.IO?
Comunicación en tiempo real bidireccional entre cliente y servidor

### ¿Para qué se usa en tu proyecto?
- Notificaciones de viajes en tiempo real
- Tracking de ubicación del conductor
- Actualizaciones de estado del viaje
- Cálculo de ETA en tiempo real

### ¿Cómo funciona?
1. Cliente se conecta con token JWT
2. Backend autentica y acepta conexión
3. Cliente y servidor intercambian eventos en tiempo real
4. Pasajero ve actualizaciones instantáneas del viaje

### Problema Resuelto
Race condition al leer token de SecureStore → Ahora se pasa token directamente

### Resultado
✅ Socket se conecta correctamente después del login
✅ Comunicación en tiempo real funciona
✅ Tracking de viajes en tiempo real operativo
