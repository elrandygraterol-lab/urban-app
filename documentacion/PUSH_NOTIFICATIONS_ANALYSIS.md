# Análisis del Sistema de Notificaciones Push

## Resumen Ejecutivo

El sistema usa **Expo Push Notifications** como servicio principal. Firebase FCM está instalado
como dependencia nativa requerida por `expo-notifications` en Android, pero **no se usa
directamente** para enviar notificaciones — todo pasa por el servicio de Expo.

---

## Arquitectura Actual

```
Dispositivo Android
  └── expo-notifications (SDK nativo)
        └── requiere google-services.json (FCM) para compilar en Android
              └── obtiene ExponentPushToken[xxx]
                    └── se registra en el backend

Backend (Node.js)
  └── unifiedPushService
        ├── si token empieza con "ExponentPushToken[" → expoPushService → api.expo.io
        └── si token es FCM nativo → firebaseService → FCM directo
```

### Flujo completo paso a paso

1. **App abre** → `useNotifications` hook se ejecuta en `_layout.tsx`
2. **Pide permiso** → `Notifications.requestPermissionsAsync()`
3. **Obtiene token** → `Notifications.getExpoPushTokenAsync({ projectId })` → devuelve `ExponentPushToken[...]`
4. **Registra token** → `POST /api/notifications/register-device` → guarda en `NotificationToken` en BD
5. **Backend envía notificación** → `NotificationService.sendPushNotificationToUser(userId, ...)` → `unifiedPushService.sendToUser()` → detecta tipo de token → `expoPushService` → `api.expo.io/--/api/v2/push/send`
6. **Expo reenvía** → Expo Push Service → FCM → dispositivo Android
7. **App recibe** → `addNotificationReceivedListener` o `addNotificationResponseReceivedListener`
8. **Navega** → `handleNotificationResponse()` según `data.type`

---

## Por qué Firebase está instalado si no se usa directamente

`expo-notifications` en Android **requiere** que el proyecto tenga configurado Firebase FCM
a nivel nativo para poder recibir notificaciones en background. Esto es una limitación de
Android — las notificaciones push en background en Android siempre pasan por FCM.

**Lo que pasa realmente:**
- El token que se obtiene es un `ExponentPushToken` (no un FCM token)
- Expo Push Service recibe ese token, lo traduce internamente a FCM y lo envía
- El `google-services.json` es necesario para que el APK compile y pueda recibir mensajes FCM
- Tú nunca interactúas con FCM directamente

**Conclusión:** Firebase está correctamente configurado como infraestructura de transporte.
No necesitas cambiarlo.

---

## Estado de Completitud

### ✅ Completado y funcionando

| Componente | Estado | Descripción |
|---|---|---|
| `useNotifications` hook | ✅ | Obtiene token, maneja permisos, listeners |
| Token registration | ✅ | `POST /api/notifications/register-device` |
| `NotificationService` backend | ✅ | Todos los métodos de envío implementados |
| `unifiedPushService` | ✅ | Auto-detecta Expo vs FCM tokens |
| `expoPushService` | ✅ | Envío via Expo Push API |
| Notification channel Android | ✅ | Canal "default" con MAX importance |
| Foreground notifications | ✅ | `setNotificationHandler` configurado |
| Tap navigation | ✅ | `handleNotificationResponse` con todos los tipos |
| Preferencias por usuario | ✅ | `notifyRideAccepted`, `notifyDriverArrived`, etc. |
| Retry logic (backend) | ✅ | Exponential backoff en `sendWithRetry` |
| Retry logic (frontend) | ✅ | 3 intentos con backoff para errores transitorios |
| FCM `SERVICE_NOT_AVAILABLE` | ✅ | Silenciado correctamente, no bloquea la app |
| Notificaciones de viaje | ✅ | ride_accepted, driver_arrived, ride_started, ride_completed, ride_cancelled |
| Notificaciones de pago | ✅ | payment_completed, payment_processed |
| Notificaciones de tienda | ✅ | store_approved, store_rejected, new_review |

### ⚠️ Pendiente / Mejorable

| Componente | Prioridad | Descripción |
|---|---|---|
| **Receipt delivery verification** | Alta | El backend envía tickets pero no verifica si fueron entregados (Expo recomienda consultar `/push/getReceipts` 15-30 min después) |
| **Token cleanup** | Media | Tokens `DeviceNotRegistered` no se eliminan automáticamente de la BD |
| **Background notifications (iOS)** | Media | No hay `GoogleService-Info.plist` configurado para iOS |
| **Notification categories** | Baja | No hay acciones interactivas en notificaciones (ej: "Aceptar viaje" desde la notificación) |
| **Badge count sync** | Baja | El badge se incrementa localmente pero no se sincroniza con el servidor al abrir la app |

---

## El Problema del `SERVICE_NOT_AVAILABLE`

Este error ocurre cuando:
- Se prueba en un **emulador sin Google Play Services**
- El dispositivo tiene Google Play Services desactualizado

**En producción (APK instalado en dispositivo real) este error NO ocurre.**

El código ya lo maneja correctamente — retorna `null` sin lanzar error y la app sigue funcionando.

---

## Qué Falta para Producción Robusta

### 1. Receipt Verification (Alta prioridad)

Expo Push Service devuelve "tickets" al enviar. Hay que consultar los recibos para saber
si la notificación fue realmente entregada al dispositivo.

```typescript
// backend/src/jobs/notificationReceiptJob.ts
// Ejecutar cada 30 minutos
const receipts = await expo.getPushNotificationReceiptsAsync(ticketIds);
for (const [id, receipt] of Object.entries(receipts)) {
  if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
    // Eliminar token de la BD
    await prisma.notificationToken.updateMany({
      where: { token: tokenMap[id] },
      data: { isActive: false }
    });
  }
}
```

### 2. Token Cleanup Automático

Cuando un token es inválido (`DeviceNotRegistered`), marcarlo como inactivo:

```typescript
// En expoPushService.ts, cuando ticket.details?.error === 'DeviceNotRegistered'
await prisma.notificationToken.updateMany({
  where: { token },
  data: { isActive: false }
});
```

### 3. Verificar projectId en EAS

El `projectId` debe coincidir exactamente con el de `eas.json`:

```typescript
// En useNotifications.ts — ya está implementado:
const projectId = Constants.expoConfig?.extra?.eas?.projectId;
// Valor actual: '18144406-d79f-4baa-8918-1f31ecedd9a5'
```

Verificar que este ID coincide en:
- `app.config.js` → `extra.eas.projectId`
- Dashboard de Expo: https://expo.dev/accounts/[tu-cuenta]/projects/app-taxis

---

## Configuración Requerida para que Funcione en Producción

### Android (ya configurado ✅)
- `google-services.json` en `android/app/`
- `@react-native-firebase/app` en plugins
- `expo-notifications` en plugins con icono y color
- `ACCESS_COARSE_LOCATION` y `ACCESS_FINE_LOCATION` en permisos

### Variables de entorno necesarias
```bash
# .env de la app
EXPO_PUBLIC_API_URL=https://tu-backend.com

# El projectId viene de app.config.js, no de .env
```

### Backend
```bash
# No se necesita FIREBASE_SERVER_KEY si solo usas Expo Push
# El expoPushService usa expo-server-sdk que no requiere credenciales adicionales
```

---

## Flujo de Notificación de Viaje (Ejemplo Completo)

```
Pasajero solicita viaje
  → Backend: NotificationService.notifyNearbyDrivers()
    → unifiedPushService.sendToUser(driverId, { title: 'Nueva solicitud', ... })
      → prisma: busca tokens activos del conductor
      → expoPushService.sendToToken(ExponentPushToken[...], ...)
        → POST api.expo.io/--/api/v2/push/send
          → Expo → FCM → Dispositivo del conductor
            → expo-notifications recibe en background
              → Android muestra notificación
                → Conductor toca notificación
                  → handleNotificationResponse({ type: 'ride_request' })
                    → router.push('/(driver)/index')
```

---

## Recomendación Final

El sistema está **funcionalmente completo** para producción. Las notificaciones push funcionan
correctamente en dispositivos reales con APK compilado via EAS.

Las mejoras pendientes (receipt verification, token cleanup) son optimizaciones de robustez
que se pueden implementar después del lanzamiento inicial.

**No cambies nada de Firebase** — está correctamente configurado como capa de transporte
requerida por Android. Intentar eliminarlo romperá las notificaciones en background.
