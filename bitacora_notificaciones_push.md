# Bitácora — Notificaciones Push

**Versión de auditoría:** 31 de julio de 2026
**Última actualización:** 2 de agosto de 2026
**Estado general:** ✅ **Implementación completa en código** (FCM directo + siempre-push + token refresh + descarte de solicitudes entre conductores) — **hallazgo real en campo** (push no llegaba ni con app minimizada ni cerrada): causa raíz identificada (**sin tokens FCM en la BD** — todos eran `ExponentPushToken[...]` residuales de builds previos/Expo Go) → **tokens purgados + limpieza automática implementada** (02/08). Pendiente despliegue en VPS y prueba de campo.

---

## Arquitectura (resumen)

```
Dispositivo Android
  └── expo-notifications (SDK nativo)
        └── google-services.json (FCM) requerido para compilar y recibir en background
              └── getDevicePushTokenAsync() → token FCM nativo
                    └── POST /api/notifications/register-device (backend)

Backend
  └── unifiedPushService
        ├── token "ExponentPushToken["/"ExpoPushToken[" → expoPushService → api.expo.io (iOS/futuro/legacy)
        └── token FCM nativo                              → firebaseService → FCM v1 directo (PRIMARIO en Android)
```

**Punto clave:** el envío es de tipo *notification* (`title` + `body`), por lo que Android/FCM los
muestra incluso con la app **cerrada (killed)**, sin que el JS esté corriendo.

---

## Estado actual por componente

| Componente | Estado | Detalle |
|---|---|---|
| Config Firebase Android | ✅ CORRECTO | Los 3 archivos `google-services.json`, `google-services-dev.json`, `google-services-preview.json` tienen sus clientes por perfil (ver sección siguiente). |
| `useNotifications` hook | ✅ | Permisos, canales, token, listeners, retry (3 intentos), silencia `SERVICE_NOT_AVAILABLE`. |
| Token en Android | ✅ FCM DIRECTO | `getDevicePushTokenAsync()` → token FCM nativo (desde 31/07). iOS conserva `getExpoPushTokenAsync`. |
| Canales Android | ✅ | `ride_requests` (MAX + bypassDnd), `ride_status`, `payments`, `default`. |
| Registro de token | ✅ | `POST /api/notifications/register-device` (montado en `app.ts:214`). |
| Envío backend (FCM) | ✅ | `firebaseService` con `android.priority='high'` + **`channelId` por tipo** (31/07). |
| Envío backend (Expo) | ✅ respaldo | `expoPushService` intacto para tokens Expo (iOS/legacy). |
| Dedup de tokens | ✅ | Al registrar un token FCM se desactivan tokens Expo activos del mismo usuario+plataforma (evita duplicados en la migración). |
| Receipt job | ✅ | `server.ts:101` — solo aplica a tickets Expo; no-op con tokens FCM. |
| Tap navigation (background) | ✅ | `addNotificationResponseReceivedListener` → `handleNotificationResponse`. |
| Unregister al logout | ⚠️ IMPLEMENTADO (31/07) | `DELETE /api/notifications/device/:token` + llamada en `authStore.logout()`. |
| Tap en cold start (killed) | ⚠️ IMPLEMENTADO (31/07) | `getLastNotificationResponseAsync()` en el efecto inicial. |
| FCM directo (firebaseService) | ✅ CREDENCIAL OK | `firebase-service-account.json` ya está en el VPS (`/home/urbantaxi/backend-urban-taxis/config/`). |
| iOS (APNs) | ⚠️ | `GoogleService-Info.plist` para `com.urbantaxi.passenger`; no verificado en esta auditoría. |

---

## Corrección de hallazgo (falso positivo) — google-services por perfil

Durante la auditoría inicial se reportó que `google-services-dev.json` y `google-services-preview.json`
solo tenían el cliente `com.urbantaxi.app` y que los builds de development/preview fallarían.

**Verificación con el archivo completo (NO truncado):**

| Archivo | Clientes | `mobilesdk_app_id` |
|---|---|---|
| `google-services.json` | `com.urbantaxi.app` | `1:466121819334:android:e79ecf7d46be84231883c7` |
| `google-services-dev.json` | `com.urbantaxi.app`, `com.urbantaxi.app.dev`, `com.urbantaxi.app.preview` | dev: `...ad165a9a06f32f7f1883c7` |
| `google-services-preview.json` | `com.urbantaxi.app`, `com.urbantaxi.app.preview`, `com.urbantaxi.passenger` (legacy) | preview: `...53a7098522bbe3561883c7` |

**Conclusión:** los paquetes `.dev`/`.preview` YA están registrados en Firebase
(`urban-notification-7e090`) con sus propios app IDs. No hacía falta agregar clientes.
El falso positivo vino de un grep truncado (solo mostraba el primer `package_name` de cada archivo).

---

## Mejoras aplicadas en esta sesión (31/07/2026)

1. **Unregister del token al logout** — evita que un token huérfano reciba push de una sesión
   cerrada. Endpoint backend ya existía (`DELETE /api/notifications/device/:token`); se agregó
   `unregisterDevice` al cliente API y su llamada en `authStore.logout()` (con try/catch silencioso).

2. **Tap en cold start** — al abrir la app desde una notificación con la app eliminada del
   proceso (killed), ahora `Notifications.getLastNotificationResponseAsync()` reutiliza
   `handleNotificationResponse` para navegar. El listener de respuesta solo cubría
   background → foreground.

3. **Limpieza** — eliminado el cliente legacy `com.urbantaxi.passenger` de
   `google-services-preview.json` (era sobrante de una app anterior y generaba confusión).

## Migración a FCM directo (implementada en código, 31/07/2026)

**Decisión:** FCM directo como vía primaria en Android (elimina el relay de Expo como punto único
de fallo; entrega directa desde `firebase-admin`). Expo Push Service queda como respaldo/código
inactivo (iOS futuro).

**Cambios backend:**
- `src/services/firebaseService.ts`:
  - `getChannelIdForType()` — mapeo por tipo (`ride_request`→`ride_requests`, estados→`ride_status`, pagos→`payments`, resto→`default`).
  - `getAndroidConfig()` — `android.priority='high'` + `android.notification.channelId` + `sound='default'` en `sendToToken` y `sendToMultipleTokens`. **Crítico:** sin `channelId` las notificaciones caen en `default` y pierden el `bypassDnd` del canal `ride_requests`.
- `src/controllers/notificationController.ts` — `registerDevice`: al registrar un token FCM,
  desactiva tokens Expo activos del mismo `userId`+`platform` (`startsWith 'Expo'` y `≠ token`) →
  evita notificaciones duplicadas en dispositivos que actualizan la app.

**Cambios frontend:**
- `hooks/useNotifications.ts` — en Android, `Notifications.getDevicePushTokenAsync()` devuelve el
  token FCM nativo (en lugar de `getExpoPushTokenAsync`). iOS conserva el token Expo. El registro,
  unregister y cold-start no cambian: `unifiedPushService` enruta el token FCM a `firebaseService`
  automáticamente.

**Verificación:** `npx tsc --noEmit` limpio en backend y frontend.

**Pendiente de despliegue:** `npm run build && pm2 restart urban` en el VPS + prueba de campo
(ver siguiente sección).

---

## Fix: "Siempre push" para eventos de viaje + supresión en foreground (31/07/2026)

**Problema:** con la app minimizada (segundo plano), el socket del conductor sigue "conectado"
hasta ~85s (`pingInterval 25s + pingTimeout 60s`). Como el push se gateaba con `isUserConnected`,
el conductor perdía la solicitud de viaje sin push ni modal.

**Cambios backend (siempre push, sin gate de socket):**
- `src/services/notificationService.ts` — `sendPushIfDisconnected` → **`sendRideNotification`**:
  elimina el gate `isUserConnected`; el push se envía SIEMPRE en eventos críticos de viaje
  (`ride_accepted`, `driver_arrived`, `ride_started`, `ride_completed`, `ride_cancelled`,
  `payment_completed`, `commission_credited`). Se quitó el import `isUserConnected`.
- `src/services/rideNotificationHandler.ts` — eliminados los gates `isUserConnected` en
  `RIDE_REQUESTED` y `RIDE_CANCELLED`; se conserva el re-check de disponibilidad del driver
  (verificación `isAvailable && verified` antes de notificar).
- `src/controllers/rideController.ts` — auto-cancel a los 60s: eliminada la llamada directa a
  `notifyRideCancelled` (era doble push junto al pub/sub `RIDE_CANCELLED`). El pub/sub es la
  única ruta de notificación.

**Cambios frontend (`hooks/useNotifications.ts`):**
- `setNotificationHandler`: suprime la alerta/sonido del sistema solo si el tipo es de viaje
  crítico Y la app está en foreground (`AppState.currentState === 'active'`) Y el socket está
  conectado (el evento ya se mostró in-app: modal/banner). En background/killed (o socket muerto)
  se muestra la alerta del sistema — cierra el hueco de la app minimizada.
- Dedupe en `addNotificationReceivedListener`: `showStatus` se omite para los tipos que el socket
  ya entrega en foreground (`commission_credited` no tiene canal socket → siempre se muestra).
- `isSocketConnected()` se importa de forma dinámica (evita romper el entorno jest).

**Verificación:**
- `npx tsc --noEmit` limpio en backend y frontend.
- `rideController.test.ts`: 34 failed / 31 passed — **idéntico con y sin estos cambios**
  (baseline; fallos pre-existentes por mock drift, "500 Internal Server Error" en todas las rutas).
- Tests de notificaciones (`notificationService.test.ts`, `notificationService.pushMethods.test.ts`,
  `useNotifications.store.test.ts`) ya fallaban por errores TS/transform previos al fix — sin regresión.

---

## Cierre para el 100% funcional (31/07/2026)

**1. Token refresh — `hooks/useNotifications.ts`:**
- Nuevo `Notifications.addPushTokenListener`: cuando Android/iOS rota el token (update de Play
  Services, expiración, restauración) se actualiza `expoPushToken` + `setActivePushToken`, y el
  efecto de registro re-llama `registerDeviceToken` con el token nuevo. Antes, un token rotado en
  caliente apagaba los push hasta el próximo arranque en frío.
- Extracción robusta del token (`data` string para FCM Android, objeto anidado para Expo/iOS).

**2. Descartar la solicitud en los otros conductores al aceptar — backend + frontend:**
- `rideNotificationHandler.ts` (RIDE_REQUESTED): guarda en Redis `ride:request:drivers:<rideId>` →
  `driverIds` ofrecidos, TTL 75s (cubre la ventana de auto-cancel de 60s).
- `rideNotificationHandler.ts` (RIDE_ACCEPTED): lee la lista, excluye al conductor que aceptó
  (`driverUserId`) y emite `ride:request_accepted` por socket a los demás (sin push — una
  notificación de sistema ya mostrada no se puede retirar; el socket cubre el caso foreground).
- `useGlobalSocketListeners.ts`: nuevo handler `ride:request_accepted` que llama `dismissRideRequest`
  solo si el request activo corresponde al `rideId` aceptado (registrado/limpiado junto con los
  demás listeners de driver).

**Verificación:** `npx tsc --noEmit` limpio en backend y frontend. Tests de listeners globales
fallan pre-existentes por transform de ESM en `services/api/client.ts` (sin relación con estos cambios).

---

## Hallazgo en campo + solución — push no llegaba con build dev (02/08/2026)

**Síntoma reportado:** con la app de conductor compilada por EAS (perfil development, `.dev` APK),
la notificación de solicitud NO llegaba **en ningún caso** (ni con la app abierta, ni en segundo
plano, y por supuesto tampoco con app force-stop). El backend logueaba `Sending notifications:
N Expo, 0 FCM` y `Sent Expo notifications: X successful, 0 failed`.

**Diagnóstico (causa raíz):** dos condiciones combinadas explicaban el síntoma.

1. **Falta del service account de Firebase en el backend (dev local):**
   - `.env:59` / `.env.production:46` → `FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json`.
   - Ese archivo **no existía** en `backend-urban-taxis/config/` (solo había config de mapbox/osrm/osm).
   - `firebaseService.ts:41-52`: al no existir el archivo, `initialize()` deja `initialized=false`.
   - `firebaseService.ts:132-135` y `:184-187`: con `initialized=false`, `sendToToken`/`sendToMultipleTokens`
     devuelven `successCount:0` **en silencio** → el build dev produce un token **FCM nativo**
     (`useNotifications.ts:415`) que se enruta a `firebaseService`, que está muerto → "0 FCM".
   - Esto explica el "no llega EN NINGÚN caso, ni abierta".

2. **Tokens Expo viejos acumulados (secundario).** El `/send` de Expo solo confirma que el ticket fue
   aceptado (`expoPushService.ts:172-175`), no la entrega al dispositivo. Los registros mostraban 2-3
   `ExponentPushToken[...]` activos del mismo usuario (reinstalaciones) y Expo confirmaba "aceptado"
   aunque fueran `DeviceNotRegistered`; la detección real tardaba 30 min (`notificationReceiptJob.ts:192`).

**Solución aplicada / preparada:**

- **`config/firebase-service-account.json` COLOCADO (`02/08`).** Nueva key descargada de la consola
  Firebase del proyecto `urban-notification-7e090`. Validado: `type=service_account`,
  `project_id=urban-notification-7e090` (coincide con `google-services-dev.json` y `FIREBASE_PROJECT_ID`),
  `client_email=firebase-adminsdk-fbsvc@...`, `private_key` presente. `.gitignore:44-45` lo protege.
- **Envía FCM ya marca tokens inválidos al instante** (`firebaseService.ts:211-233`): sin cambios.
- **Limpiar automáticamente los tokens viejos (EJECUTADO 02/08):**
  - `notificationReceiptJob.ts:192` → cron `*/30 * * * *` → **`*/2 * * * *`** (cada 2 min).
  - `notificationController.registerDevice` → activar **1 único token activo por `userId`+`platform`**
    (desactivar los demás activos del mismo usuario+plataforma). Regla de "un dispositivo por user+platform".
  - Verificación: `npx tsc --noEmit` limpio; tests `notificationController.registerDevice` 2/2 OK
    (incluye aserción nueva del `updateMany` de dedup tras añadir `count` al mock). Los 2 fallos restantes
    del suite son drift pre-existente en `sendTestNotification` (mockea `firebaseService` pero el
    controller usa `unifiedPushService`).

**Próximos pasos** (tras ejecutar lo anterior):

| # | Tarea | Detalle |
|---|---|---|
| X1 | ~~Ejecutar cambios de limpieza de tokens + recepción cada 2 min~~ | **HECHO** — `notificationReceiptJob.ts` y `notificationController.ts` actualizados (02/08). |
| X2 | Verificar con build dev | Reinstalar APK `.dev`, disparar ride request y confirmar en logs `Successfully sent notification to token:` (FCM) / no "0 FCM". |
| X3 | Re-validar caso force-stop | Con token FCM real, comprobar entrega con app cerrada (depende del worker/canal y restricciones de batería Android, no del backend). |
| X4 | Desplegar en VPS | `npm run build && pm2 restart urban`; log `Firebase Admin SDK initialized successfully`. |

---

## Pendientes / Riesgos conocidos

| # | Tarea | Prioridad | Detalle |
|---|---|---|---|
| 1 | Desplegar en VPS | Alta | `npm run build && pm2 restart urban`; verificar log `Firebase Admin SDK initialized successfully`. |
| 2 | Prueba de campo con APK real | Alta | Probar: app cerrada (kill manual) recibiendo push + tap → navegación correcta; canal `ride_requests` con sonido incluso en No Molestar. |
| 3 | Verificar dedup en la migración | Media | Al hacer login con el build nuevo, el token Expo viejo debe quedar `isActive=false` y registrarse el token FCM. |
| 4 | Configurar FCM V1 en EAS | Media (si no existe) | Necesario solo si se vuelve al camino Expo (respaldo/iOS). |
| 5 | `com.urbantaxi.passenger` en Firebase Console | Baja | El cliente legacy se eliminó del JSON; opcional borrarlo también en la consola. |
| 6 | iOS APNs | Media | Verificar APNs key en EAS y plist; no auditado a fondo. |

---

## Limpieza de tokens: diagnóstico + solución automática (02/08/2026)

**Rediagnóstico en campo (con service account YA colocado):** el push seguía sin llegar con la
app minimizada ni cerrada. Los logs de esta pasada mostraron la causa real: **no había NINGÚN
token FCM en la BD**, todos los envíos eran `Sending notifications: X Expo, 0 FCM` hacia el relay
de Expo. Los tokens activos eran `ExponentPushToken[...]` residuales (de builds previos a la
migración FCM / Expo Go) y se halló un mismo token (`ExponentPushToken[A1iz...]`) asignado a
**3 usuarios distintos** (contaminado/reutilizado en emulador). Con esos tokens, el backend nunca
usa `firebaseService`, que es el único que entrega con la app force-stop.

**Decisión:** se prioritizó la limpieza manual + una limpieza automática que detecte y elimine
tokens de builds viejos cuando se suba a producción (backend + frontend), para que los push
funcionen tras cada actualización de build sin intervención manual.

**Cambios backend:**
- `src/services/tokenCleanupService.ts` — nuevo método `cleanStaleTokens()` (reglas idempotentes):
  1. **Legacy Android** → tokens `ExponentPushToken[`/`ExpoPushToken[` con `platform='android'`
     (builds Expo Go previos a la migración FCM) → desactivados.
  2. **Contaminados** → token compartido por >1 usuario distinto (reuso de instrumento) → los
     activos de ese valor se desactivan (no se puede saber cuál es válido).
  3. **Duplicados por user+platform** → se conserva SOLO el activo más reciente y se desactivan
     los demás ("un dispositivo por user+platform").
- `src/jobs/staleTokenCleanupJob.ts` (nuevo) → `runStaleTokenCleanup()` a los 3s de arranque y
  luego cada 6h (`0 */6 * * *`). Registrado en `server.ts` (bloque "stale push token cleanup").
- `src/scripts/cleanup-push-tokens.ts` (nuevo) → one-off manual que reutiliza `cleanStaleTokens()`;
  soporta `-- --dry-run` para sólo reportar antes de modificar.

**Limpieza manual ejecutada (02/08) contra BD dev:** 24 candidatos (dry-run), 14 tokens
desactivados realmente (`legacyExpo=14`, contaminados/duplicados ya cubiertos por el paso 1).
Resultado final: `ACTIVE=0`, `INACTIVE=16`. No había tokens FCM reales que se perdieran.

**Verificación:** `npx tsc --noEmit` limpio; `notificationController.registerDevice` 2/2 OK; los
2 fallos de suite siguen siendo drift pre-existente en `sendTestNotification` (sin regresión).

**Siguiente prueba (con la BD ya limpia de tokens viejos):**
| # | Tarea | Detalle |
|---|---|---|
| X2 | Verificar con build dev | Abrir APK `.dev` como conductor → re-registra token **FCM** (no `ExponentPushToken`). Esperar en logs `Sent notifications: 0 Expo, N FCM` y `Successfully sent notification to token:`. |
| X3 | Re-validar caso force-stop | Con token FCM real, comprobar entrega con app cerrada (depende del worker/canal y restricciones de batería Android). |
| X4 | Desplegar en VPS | `npm run build && pm2 restart urban`; ver `Stale push token cleanup job initialized` + `Firebase Admin SDK initialized successfully`. La limpieza automática correrá al arrancar y cada 6h. |

---

## Referencias

- Análisis completo: `documentacion/PUSH_NOTIFICATIONS_ANALYSIS.md`
- Config EAS: `eas.json` (perfiles development/preview/production)
- `app.config.js:9` — packages por perfil (`com.urbantaxi.app`, `.dev`, `.preview`)
- Backend: `notificationController.ts`, `unifiedPushService.ts`, `expoPushService.ts`, `firebaseService.ts`
- Hook: `hooks/useNotifications.ts` (montado en `app/_layout.tsx:58`)
- Auth: `store/authStore.ts:264` (logout con unregister del token)
