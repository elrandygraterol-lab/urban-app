# Avance del Día — UrbanTaxi SJ 03/07/2026

## 1. Aviso de Simulación Pago Móvil en Política de Privacidad

**Archivo:** `app/(legal)/privacy-policy.tsx`

Se agregó una nota en la política de privacidad informando que la verificación de pago móvil (Pago Móvil) está en modo simulación/mock, y que no se realizan cobros reales durante las pruebas.

---

## 2. Fix: Etiqueta JSX en privacy-policy.tsx

**Archivo:** `app/(legal)/privacy-policy.tsx`

Se corrigió una etiqueta de cierre `</Section>` huérfana que quedó durante una edición anterior, causando error de compilación JSX.

---

## 3. Fix: Visualización de Calificaciones en Historial del Pasajero

**Archivos modificados:**
- `app/(passenger)/trip-history.tsx`
- `types/api.ts`

**Problema:** En la vista de historial del pasajero se mostraba la calificación que el conductor le puso al pasajero (en lugar de la que el pasajero le puso al conductor), y no se mostraba el rating promedio del conductor.

**Solución:**
- Se agregó el campo `conductorRating` a la respuesta de la API
- En la tarjeta de historial siempre se muestra el rating promedio del conductor
- En el modal de detalle se muestra la calificación que el pasajero le dio al conductor
- Se preservó la calificación del conductor al pasajero para futuros usos

---

## 4. Configuración EAS / Build de Producción

**Archivo:** `eas.json`

**Cambios:**
- `EXPO_PUBLIC_API_URL` apunta a `https://administracionurbantaxis.com`
- Se agregó `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` desde secrets de EAS
- Se agregó `EXPO_NO_DOTENV: "1"` para evitar conflictos con variables de entorno

**Archivo:** `app.config.js`

- `usesCleartextTraffic` ahora es dinámico: `true` solo en desarrollo, `false` en producción
- Google Maps API Key se carga desde `process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`

---

## 5. Renombre de App a "UrbanTaxi SJ"

**Archivos modificados:**
- `app.config.js` — nombre legal cambiado a "UrbanTaxi SJ"
- `app/(legal)/privacy-policy.tsx` — texto actualizado
- `app/(legal)/terms-of-service.tsx` — texto actualizado
- `constants/legalText.ts` — textos legales actualizados
- `hooks/useRideTracking.ts` — referencias actualizadas
- `hooks/useNotifications.ts` — referencias actualizadas
- `store/authStore.ts` — nombre de dominio persistente

---

## 6. Fix: Bug de Marcadores Cuadrados en Android (GPU Mali)

**Archivo:** `src/components/map/markers.tsx`

**Problema:** En dispositivos Android con GPU Mali, los `<Marker>` que usaban `<View>` como hijo (con `borderRadius`) renderizaban los bordes redondeados como cuadrados negros en el píxel inferior derecho. La causa raíz es que react-native-maps convierte los View hijos en texturas OpenGL, y las GPUs Mali tienen un bug de clipping en `borderRadius`.

**Solución:**
- Se crearon 4 PNG pre-renderizados en `assets/iconos-maps/` (conductor.png, pasajero.png, recogida.png, destino.png)
- Se exporta `MARKER_ICONS` con todos los iconos via `require()`
- Todos los `<Marker>` en las 5 pantallas ahora usan `icon={MARKER_ICONS.xxx}` en lugar de View children

**Pantallas actualizadas:**
- `app/(passenger)/index.tsx`
- `app/(driver)/active-ride.tsx`
- `app/(driver)/index.tsx`
- `app/(passenger)/delegated-ride-tracking.tsx`
- `app/(driver)/manage-ride.tsx`

**Documentación:** `INFORME_BUG_MARKERS_GPU.md` — diagnóstico completo con 8 soluciones potenciales documentadas.

---

## 7. Fix: Sincronización de Estado del Viaje (Socket + Polling)

### 7.1 Limpieza Selectiva de Listeners Socket

**Archivo:** `services/socket.ts`

**Problema:** Las funciones utilitarias usaban `socket.off(event)` sin callback, lo que eliminaba **todos** los listeners de ese evento, incluyendo los globales. Al cambiar de pestaña, los listeners globales desaparecían y el usuario dejaba de recibir actualizaciones.

**Solución:** Las 7 funciones utilitarias ahora devuelven funciones de limpieza específicas por callback:
- `onRideAccepted()` → devuelve `() => { socket.off('ride:accepted', handler); }`
- `onRideStatusChanged()` → ídem
- `onDriverLocationUpdate()` → ídem
- `onETAUpdate()` → ídem
- `onDriverArrived()` → ídem
- `onRideCancelled()` → ídem
- `onRideCompleted()` → ídem

### 7.2 Listeners Globales Funcionales

**Archivo:** `hooks/useGlobalSocketListeners.ts`

- Los handlers de pasajero ahora muestran notificaciones (toast/alert) para: arrived, in_progress, accepted, cancelled
- Se agregó listener global para `ride:driver_arrived`

### 7.3 Passenger Index — Listeners + Polling + Reconexión

**Archivo:** `app/(passenger)/index.tsx`

- Se eliminó `removeRideListeners()` (que mataba listeners globales)
- Se usan refs de limpieza para cada listener individual
- Reconexión del socket re-registra todos los listeners activos
- Polling cada 5s incluye status `'pending'` (antes solo `'accepted'`)
- Se agregó `activeRideRef` sincronizado con `useEffect` para eliminar stale closures

### 7.4 Driver Active Ride — Reintentos + Polling + Location Buffer

**Archivo:** `app/(driver)/active-ride.tsx`

- `updateRideStatus` reintenta 3 veces con backoff (1s, 2s, 4s)
- `handleConfirmCancelRide` limpia estado inmediatamente si la API responde OK
- Polling cada 10s para detectar cambios de estado
- GPS location se bufferiza cuando socket está desconectado y se envía al reconectar

---

## 8. Fix: Modal de Calificación Duplicado

**Archivo:** `app/(passenger)/index.tsx`

**Problema:** Al completarse un viaje, el modal de calificación aparecía dos veces — una por el listener global (`useGlobalSocketListeners`) y otra por el listener local registrado en el componente.

**Solución:** Se unificó la lógica: solo el listener local maneja `ride:completed` cuando la pantalla de pasajero está activa, y el global solo muestra notificaciones ligeras (no modales).

---

## 9. Resiliencia de Red

### 9.1 NetInfo + Offline Banner

**Archivo nuevo:** `components/OfflineBanner.tsx`

- Banner rojo animado (SlideIn/SlideOut) que se muestra cuando no hay internet
- Posicionado globalmente con z-index 9999
- Detecta conexión vía `@react-native-community/netinfo`

**Archivo:** `app/_layout.tsx`

- OfflineBanner montado globalmente
- Se inicializa `useNetworkStatus`

### 9.2 useNetworkStatus Hook

**Archivo nuevo:** `hooks/useNetworkStatus.ts`

- Detecta conectividad, tipo de red (cellular/WiFi), internet reachable
- `addNetworkListener(fn)` — suscripción global a cambios de red
- `getNetworkStatus()` — estado actual síncrono
- `useNetworkTimeout(baseTimeoutMs)` — duplica timeout en redes lentas
- `notifyNetworkChange()` — notifica a todos los suscriptores

### 9.3 useNetworkRecovery Hook + Utilidades

**Archivo nuevo:** `hooks/useNetworkRecovery.ts`

- `useNetworkRecovery(onRecover)` — ejecuta callback cuando el internet regresa después de estar caído. Throttle de 5s entre recuperaciones
- `retryWithBackoff(fn, maxRetries, delay)` — reintenta una función asíncrona con backoff exponencial (delay × 1, × 2, × 4...)
- `isNetworkError(error)` — detecta errores de red (timeout, DNS, conexión rechazada, etc.)

### 9.4 Reintentos Automáticos

| Operación | Archivo | Mecanismo |
|-----------|---------|-----------|
| Cambio de estado del conductor | `app/(driver)/active-ride.tsx` | 3 reintentos con backoff 1s/2s/4s |
| Confirmación de pago del pasajero | `app/(passenger)/index.tsx` | 3 reintentos con backoff 1.5s |
| Envío de calificación (pasajero) | `app/(passenger)/index.tsx` | 3 reintentos con backoff 1s |
| Envío de calificación (conductor) | `app/(driver)/active-ride.tsx` | 3 reintentos con backoff 1s |

### 9.5 Timeouts Adaptativos

**Archivo:** `services/api/client.ts`

- `DEFAULT_TIMEOUT` = 15s
- `CANCELLATION_TIMEOUT` = 20s
- `CRITICAL_TIMEOUT` = 25s
- `getAdaptiveTimeout(base)` — multiplica por 1.5× en redes lentas (cellular)

---

## 10. Recuperación Background/Foreground

### 10.1 Stale Closures en restoreActiveRide

**Problema:** `restoreActiveRide` capturaba `activeRide = null` inicial porque el `useEffect` solo dependía de `[token]`, y al minimizar la app la ref seguía siendo la inicial.

**Solución:**
- Se agregó `activeRideRef` sincronizado vía `useEffect(() => { activeRideRef.current = activeRide; }, [activeRide])`
- `restoreActiveRide` ahora usa `activeRideRef.current` en lugar de `activeRide`

### 10.2 Recuperación Automática al Volver el Internet

| Rol | Archivo | Qué hace |
|-----|---------|----------|
| Pasajero | `app/(passenger)/index.tsx` | Reconecta socket, re-fetch de viajes activos, restaura direcciones/coordenadas, re-registra listeners |
| Conductor | `app/(driver)/active-ride.tsx` | Reconecta socket, re-une al ride room, re-fetch del ride, re-dibuja ruta |

---

## 11. TypeScript — Correcciones

**Archivos corregidos:**
- `hooks/useNetworkRecovery.ts` — se eliminó `useCallback` no utilizado
- `hooks/useNetworkStatus.ts` — `addNetworkListener` ahora con tipo explícito `() => void` (antes devolvía `boolean` de `Set.delete()`)
- `app/(driver)/active-ride.tsx` — `destinationLatitude`/`destinationLongitude` no existen en el tipo `Ride`; se accede via `(ride as any)`

Estado final: **0 errores de TypeScript**.

## 12. Fix: Ruta no se dibujaba inmediatamente al aceptar viaje

**Archivo:** `app/(passenger)/index.tsx`

**Problema:** Cuando un conductor aceptaba el viaje, la ruta desde su ubicación hasta el punto de recogida no se dibujaba en el mapa del pasajero hasta que llegaba el primer evento `driver:location_update` (~1-2s después). El guard `if (listenerVersion === 0) return;` en el efecto de ruta (línea 1557) bloqueaba el dibujo inicial porque `listenerVersion` seguía en 0 al no haber viaje activo durante el montaje inicial.

**Solución:** Se eliminó la guarda `listenerVersion === 0`. Las condiciones restantes (`!activeRide`, `!driverLocation`, `routeCoordinates.length === 0`) ya protegen contra ejecuciones prematuras.

**Verificado:** La ruta se dibuja correctamente en todos los escenarios:
- Búsqueda previa (pasajero selecciona origen/destino antes de solicitar)
- Conductor acepta (ruta driver → pickup se dibuja inmediatamente)
- Transición `accepted` → `arrived` → `in_progress` (ruta se limpia al llegar, se redibuja al iniciar)
- Restauración desde background (foreground handler incrementa `listenerVersion`)
- Recuperación de red (`useNetworkRecovery` + polling)
- Múltiples waypoints (pickupPoints/destinationPoints)
- Polyline recortado dinámicamente (`slicedRouteCoords` + `nearestRouteIndex`)

**Falsos bugs descartados:**
- `calculateRoute` usa `routeData.polyline` y `updateDynamicRoute` usa `routeData.coordinates` — no es bug, el backend devuelve ambos campos (`osrmService.ts:254-258`)
- Ruta al restaurar desde background — funciona porque `restoreActiveRide`.then() incrementa `listenerVersion`, disparando el efecto de ruta
- Throttle de 30s en ruta dinámica — intencional para evitar llamadas API excesivas

---

## Resumen de Archivos Creados

| Archivo | Descripción |
|---------|-------------|
| `components/OfflineBanner.tsx` | Banner offline global animado |
| `hooks/useNetworkStatus.ts` | Hook + utilidades de monitoreo de red |
| `hooks/useNetworkRecovery.ts` | Hook + retryWithBackoff + isNetworkError |
| `INFORME_BUG_MARKERS_GPU.md` | Diagnóstico del bug de marcadores GPU Mali |

## Resumen de Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `app/(legal)/privacy-policy.tsx` | Aviso simulación Pago Móvil + fix etiqueta JSX |
| `app/(passenger)/trip-history.tsx` | Visualización correcta de calificaciones |
| `eas.json` | URLs de producción, API key, EXPO_NO_DOTENV |
| `app.config.js` | cleartextTraffic dinámico, API key desde env vars |
| `constants/legalText.ts` | Renombre a UrbanTaxi SJ |
| `src/components/map/markers.tsx` | MARKER_ICONS con PNGs pre-renderizados |
| `app/(passenger)/index.tsx` | Socket cleanup, polling, retry, activeRideRef, network recovery |
| `app/(driver)/active-ride.tsx` | Retry status, cleanup cancel, polling, location buffer, network recovery, retry rating |
| `app/(driver)/index.tsx` | MARKER_ICONS import |
| `app/(passenger)/delegated-ride-tracking.tsx` | MARKER_ICONS import |
| `app/(driver)/manage-ride.tsx` | MARKER_ICONS import |
| `services/socket.ts` | Cleanup functions específicas por callback |
| `hooks/useGlobalSocketListeners.ts` | Handlers funcionales para pasajero, ride:driver_arrived |
| `services/api/client.ts` | Timeouts incrementados, getAdaptiveTimeout |
| `services/api/index.ts` | Export getAdaptiveTimeout, CRITICAL_TIMEOUT |
| `store/authStore.ts` | Persistencia a SecureStore |
| `app/_layout.tsx` | OfflineBanner global, useNetworkStatus |
| `types/api.ts` | ConductorRating en RideHistory |
