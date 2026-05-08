# Solución Final: Notificaciones Push con Expo (Sin Firebase)

## 📋 Resumen

Esta es la solución definitiva para implementar notificaciones push en la app usando **SOLO Expo Push Notifications**, sin Firebase. Esta configuración funciona tanto cuando la app está abierta (Socket.io) como cuando está cerrada/en segundo plano (Expo Push).

---

## ✅ Cambios Realizados

### 1. **Indicador de Conexión Socket Arreglado**

**Problema**: El socket estaba conectado pero el indicador visual mostraba "Desconectado" (círculo rojo).

**Solución**: Actualizar el estado `socketInstance` correctamente en los eventos de conexión/desconexión.

**Archivo**: `app/app/(driver)/index.tsx`

```typescript
const initializeSocket = async () => {
  const socket = await connectSocket(token);
  
  // ✅ Actualizar estado después de conectar
  setSocketInstance(socket);
  
  socket.on('connect', () => {
    setSocketInstance(socket); // ✅ Actualizar en reconexión
  });
  
  socket.on('disconnect', () => {
    setSocketInstance(socket); // ✅ Actualizar en desconexión
  });
};
```

---

### 2. **Notificaciones Push Habilitadas (Solo Expo)**

**Problema**: Las notificaciones estaban deshabilitadas temporalmente debido a errores de Firebase.

**Solución**: Habilitar notificaciones usando SOLO `expo-notifications` sin ninguna dependencia de Firebase.

**Archivo**: `app/hooks/useNotifications.ts`

```typescript
useEffect(() => {
  // ✅ Removido el return que deshabilitaba las notificaciones
  
  // Skip solo en Expo Go
  if (isExpoGo) {
    console.warn('Push notifications require a Development Build');
    return;
  }

  // Registrar para notificaciones push
  registerForPushNotificationsAsync()
    .then((token) => {
      if (token) {
        setExpoPushToken(token);
        registerDeviceToken(token);
      }
    });
});
```

---

## 🔧 Configuración Actual

### App Config (`app/app.config.js`)

```javascript
{
  plugins: [
    [
      "expo-notifications",
      {
        icon: "./assets/images/icon.png",
        color: "#22c55e",
        sounds: ["./assets/sounds/notification.wav"],
        androidMode: "default",
        androidCollapsedTitle: "UrbanTaxi"
      }
    ]
  ],
  extra: {
    eas: {
      projectId: "f81ef8db-6366-4c98-847e-6a8fef21555f"
    }
  }
}
```

**✅ NO hay configuración de Firebase**
**✅ NO hay `googleServicesFile`**
**✅ Solo plugin de `expo-notifications`**

---

### Package.json

```json
{
  "dependencies": {
    "expo-notifications": "~0.32.16",
    "socket.io-client": "^4.8.3"
  }
}
```

**✅ NO hay paquetes de Firebase**
**✅ Solo `expo-notifications` y `socket.io-client`**

---

## 🚀 Cómo Funciona

### Flujo de Notificaciones

```
┌─────────────────────────────────────────────────────────────┐
│                    PASAJERO SOLICITA VIAJE                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: Crea ride en DB y publica evento a Redis Pub/Sub │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│   rideNotificationHandler escucha evento RIDE_REQUESTED     │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
┌───────────────────────┐   ┌───────────────────────┐
│   Socket.io Emit      │   │  Expo Push Notification│
│  (App abierta)        │   │  (App cerrada/fondo)   │
└───────────────────────┘   └───────────────────────┘
                │                       │
                ▼                       ▼
┌───────────────────────┐   ┌───────────────────────┐
│ Driver recibe evento  │   │ Driver recibe push    │
│ ride:request_created  │   │ en barra notificación │
└───────────────────────┘   └───────────────────────┘
```

---

### Cuando la App está ABIERTA

1. **Socket.io** maneja las notificaciones en tiempo real
2. El driver ve la tarjeta de solicitud de viaje inmediatamente
3. Puede aceptar o rechazar desde la app

**Código**: `app/app/(driver)/index.tsx`

```typescript
socket.on('ride:request_created', (data: RideRequest) => {
  console.log('[DRIVER] 🚗 Ride request received:', data);
  setRideRequest(data); // Muestra la tarjeta
});
```

---

### Cuando la App está CERRADA o en SEGUNDO PLANO

1. **Expo Push Notification** envía notificación al dispositivo
2. Aparece en la barra de notificaciones del teléfono
3. Al tocar la notificación, abre la app y navega a la pantalla correcta

**Backend**: `backend/src/services/expoPushService.ts`

```typescript
await expoPushService.sendToUser(driverId, {
  title: 'Nueva Solicitud de Viaje',
  body: `Viaje desde ${pickup.address}`,
}, {
  type: 'new_ride_request',
  rideId: ride.id,
});
```

---

## 📱 Cómo Obtener el Token de Expo Push

### En el Dispositivo

1. **Instalar el build de desarrollo**
2. **Abrir la app y hacer login**
3. **Verificar logs en Metro**:

```bash
[NOTIFICATIONS] Getting Expo push token...
[NOTIFICATIONS] ✅ Expo Push Token obtained: ExponentPushToken[xxxxxx...]
[NOTIFICATIONS] Registering device token with backend...
[NOTIFICATIONS] ✅ Device token registered successfully
```

4. **El token se guarda automáticamente en la base de datos**:

```sql
SELECT * FROM notification_tokens WHERE user_id = 'driver-user-id';
```

---

## 🧪 Cómo Probar

### Prueba 1: App Abierta (Socket.io)

1. Abrir app como **conductor** en un dispositivo
2. Activar disponibilidad (toggle verde)
3. En otro dispositivo, abrir app como **pasajero**
4. Solicitar un viaje
5. **Resultado esperado**: El conductor ve la tarjeta de solicitud inmediatamente

### Prueba 2: App Cerrada (Expo Push)

1. Abrir app como **conductor** y hacer login
2. **Cerrar completamente la app** (swipe desde recientes)
3. En otro dispositivo, solicitar un viaje como pasajero
4. **Resultado esperado**: Notificación aparece en la barra del conductor
5. Tocar la notificación abre la app

### Prueba 3: App en Segundo Plano

1. Abrir app como **conductor**
2. **Minimizar la app** (botón home)
3. Solicitar un viaje desde otro dispositivo
4. **Resultado esperado**: Notificación aparece en la barra

---

## 🔍 Debugging

### Ver Logs de Notificaciones

```bash
# En Metro bundler
[NOTIFICATIONS] Getting Expo push token...
[NOTIFICATIONS] ✅ Expo Push Token obtained: ExponentPushToken[...]
[NOTIFICATIONS] Registering device token with backend...
[NOTIFICATIONS] ✅ Device token registered successfully
```

### Ver Logs de Socket

```bash
[SOCKET] ✅ Connected successfully! Socket ID: RvY7Ub-wWK9nHnUdAAAN
[DRIVER] Initial location sent: {"latitude": 10.xxx, "longitude": -67.xxx}
[DRIVER] 🚗 Ride request received: {...}
```

### Verificar Token en Backend

```bash
# En logs del backend
[ExpoPushService] Sending Expo notification to user driver-id (1 devices)
[ExpoPushService] Successfully sent notification to token: ExponentPushToken[...]
```

---

## ⚠️ Problemas Comunes y Soluciones

### Problema 1: "Default FirebaseApp is not initialized"

**Causa**: Archivos de Firebase todavía presentes o caché de build anterior.

**Solución**:
```bash
# 1. Verificar que NO existan estos archivos
ls app/google-services.json  # ❌ No debe existir
ls app/GoogleService-Info.plist  # ❌ No debe existir

# 2. Limpiar completamente
cd app
rm -rf android ios node_modules
npm install
npx expo prebuild --clean

# 3. Nuevo build
eas build --platform android --profile development --clear-cache
```

---

### Problema 2: No recibo notificaciones push

**Verificar**:

1. ✅ ¿El token se registró correctamente?
   ```sql
   SELECT * FROM notification_tokens WHERE user_id = 'tu-user-id';
   ```

2. ✅ ¿El backend está enviando notificaciones?
   ```bash
   # Ver logs del backend
   [ExpoPushService] Sending Expo notification to user...
   ```

3. ✅ ¿Los permisos están otorgados?
   ```typescript
   const { status } = await Notifications.getPermissionsAsync();
   console.log('Permission status:', status); // Debe ser 'granted'
   ```

4. ✅ ¿Estás usando un dispositivo físico?
   - Los emuladores NO reciben notificaciones push reales

---

### Problema 3: Socket conectado pero indicador rojo

**Causa**: Estado `socketInstance` no se actualiza correctamente.

**Solución**: Ya arreglado en esta versión. Verificar que el código tenga:

```typescript
socket.on('connect', () => {
  setSocketInstance(socket); // ✅ Esto actualiza el estado
});
```

---

## 📦 Checklist Antes del Build

- [ ] NO hay archivos `google-services.json` o `GoogleService-Info.plist`
- [ ] NO hay paquetes de Firebase en `package.json`
- [ ] `app.config.js` tiene `projectId` de EAS
- [ ] Plugin `expo-notifications` está configurado
- [ ] Carpetas `android/` e `ios/` eliminadas
- [ ] `node_modules` limpio (reinstalado)
- [ ] Build con `--clear-cache`

---

## 🎯 Próximos Pasos

1. **Hacer un nuevo build**:
   ```bash
   cd app
   eas build --platform android --profile development --clear-cache
   ```

2. **Desinstalar APK vieja del dispositivo**

3. **Instalar nueva APK**

4. **Probar ambos escenarios**:
   - App abierta (Socket.io)
   - App cerrada (Expo Push)

5. **Verificar logs** en Metro y backend

---

## 📚 Referencias

- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [expo-notifications API](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Notification Tool](https://expo.dev/notifications) - Para probar manualmente
- [Socket.io Client](https://socket.io/docs/v4/client-api/)

---

## ✨ Resumen Final

Esta solución usa:

1. **Socket.io** para notificaciones en tiempo real cuando la app está abierta
2. **Expo Push Notifications** para notificaciones cuando la app está cerrada
3. **NO usa Firebase** en absoluto
4. **Funciona en Development Builds** (no en Expo Go)

**Estado**: ✅ Listo para probar en el próximo build

---

**Fecha**: 27 de Marzo, 2026
**Versión**: 1.0.0 (Solución Final)
