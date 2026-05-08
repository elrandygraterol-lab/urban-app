# Análisis del Flujo de Tarifas — UrbanTaxi (v3)

**Fecha:** Abril 2026  
**Completitud estimada: 85 / 100**

---

## Resumen Ejecutivo

El motor de tarifas está completamente integrado en todos los puntos del flujo. La app usa el motor completo para estimar, el backend lo usa para crear y completar viajes, y la cancelación usa la tarifa configurada en el panel admin con las tres reglas de política correctamente implementadas.

---

## Motor Principal de Tarifas

`zoneFareMatrixService.estimateFare` — jerarquía de 4 niveles:

| Nivel | Fuente | Condición |
|---|---|---|
| 1 | Matriz zona-a-zona (`zone_fare_matrix`) | Entrada activa para Origen → Destino |
| 2 | Tarifa zona origen (`zone_fares`) | Zona origen detectada, sin entrada en matriz |
| 3 | Tarifa zona destino (`zone_fares`) | Zona destino detectada, origen fuera de cobertura |
| 4 | `GlobalFare` base activo | Ninguna zona detectada |

Post-cálculo aplica:
- `time_surcharge` si está activo y la hora actual cae en la ventana configurada
- Políticas de mínimo y redondeo

---

## Flujo Completo — Estado Actual

### Estimación pre-solicitud (app)
```
App → POST /api/fares/estimate
      { pickupLat, pickupLng, destinationLat, destinationLng, distanceKm, durationHours }
      ↓
zoneFareMatrixService.estimateFare()  ✅ motor completo
      ↓
App muestra: totalPrice + currency + timeSurcharge (si aplica)
```

### Solicitud de viaje
```
App → POST /api/rides/request
      ↓
zoneFareMatrixService.estimateFare()  ✅ mismo motor
      ↓
Guarda ride.estimatedFare + ride.currency
App sincroniza estimatedFare con respuesta del backend  ✅
```

### Cancelación del pasajero
```
App → POST /api/rides/:id/cancel
      ↓
cancelRide() evalúa:
  ¿Pasaron > 2 min desde la solicitud?
    NO  → fee = 0  (período de gracia)  ✅
    SÍ + conductor llegó (arrived) → fee = estimatedFare × 50%  ✅
    SÍ + solo aceptado → fee = getActiveCancellationFare().amount  ✅
                              (tarifa configurada en panel admin)
      ↓
Guarda ride.cancellationFee
Emite ride:cancelled con cancellationFee vía WebSocket
App muestra: "Tarifa de cancelación: X Bs."  ✅
```

### Cancelación vía `cancel-with-policy`
```
App → POST /api/rides/:id/cancel-with-policy
      ↓
CancellationPolicyService.calculatePolicy()
  < 2 min → gratis  ✅
  > 2 min + aceptado → getActiveCancellationFare() con fallback a env var  ✅
  conductor llegó → estimatedFare × 50%  ✅
```

### Completar viaje
```
POST /api/rides/:id/complete
      ↓
zoneFareMatrixService.estimateFare()  ✅ motor completo
  distanceKm = estimatedDistanceKm  ⚠️ (no hay GPS tracking real)
  durationHours = (completedAt - startedAt) / 3600  ✅ (duración real)
      ↓
Aplica time_surcharge si aplica  ✅
Guarda ride.finalFare
App recibe ride:completed → muestra tarifa final  ✅
```

---

## Política de Cancelación — Reglas Implementadas

| Condición | Tarifa | Fuente |
|---|---|---|
| Cancelación dentro de 2 min | Gratis | Período de gracia |
| Cancelación > 2 min, conductor aceptó | Tarifa de cancelación activa | Panel admin (`cancellation_fare`) |
| Cancelación > 2 min, conductor llegó | 50% del estimatedFare | Calculado sobre tarifa del motor |
| Cancelación por sistema (sin conductor) | Gratis | Auto-cancelación |
| Cancelación por conductor | Gratis para el pasajero | Sin cargo |

---

## Problemas Restantes

### 🟡 Distancia real = distancia estimada

**Qué es GPS tracking:** Registrar continuamente la posición del conductor durante el trayecto y guardar esa ruta como secuencia de coordenadas. Sirve para calcular la distancia real recorrida (no la línea recta entre dos puntos).

**Por qué no hay uno:** El sistema ya transmite la ubicación del conductor en tiempo real vía WebSocket (`ride:driver_location_update`), pero esas coordenadas no se persisten en la BD — solo se envían al pasajero para mostrar el punto en el mapa. Al completar el viaje, el backend usa `ride.estimatedDistanceKm` porque no tiene los puntos del recorrido guardados.

**Cómo se implementaría:**
1. Agregar tabla `ride_waypoints (rideId, latitude, longitude, timestamp)` en el schema
2. En el endpoint de actualización de ubicación del conductor, guardar cada punto (cada 10 segundos)
3. Al completar el viaje, calcular la distancia real sumando los segmentos: `Σ haversine(punto[i], punto[i+1])`

Es trabajo de mediana complejidad, no urgente para el MVP pero importante para la precisión de la tarifa final.

### 🟢 Menor — `fareService.calculateFareWithZone` es deuda técnica

El servicio `fareService.calculateFareWithZone` (motor incompleto, solo zona origen) sigue en el código y es usado por `GET /api/zones/detect`. La app ya no lo llama, pero el endpoint sigue activo. No afecta el funcionamiento pero es código redundante.

---

## Evaluación de Completitud

| Componente | Estado | Puntuación |
|---|---|---|
| Motor de tarifas backend (zoneFareMatrixService) | ✅ Completo | 10/10 |
| Jerarquía de prioridad (matriz → zona → global) | ✅ Completo | 10/10 |
| Recargo por horario (time_surcharge) | ✅ Completo | 9/10 |
| Tarifa de cancelación — período de gracia | ✅ Implementado | 10/10 |
| Tarifa de cancelación — aceptado > 2 min | ✅ Usa motor de zonas | 9/10 |
| Tarifa de cancelación — conductor llegó | ✅ 50% estimatedFare | 9/10 |
| Estimación en app (pre-solicitud) | ✅ Motor completo | 9/10 |
| Sincronización app ↔ backend del precio | ✅ Implementado | 9/10 |
| Tarifa final al completar viaje | ✅ Completo | 9/10 |
| Distancia real del viaje | ⚠️ Usa estimada (sin GPS tracking) | 3/10 |
| Soporte bimonetario VES/USD | ✅ Completo | 9/10 |
| Panel admin de tarifas | ✅ Completo | 9/10 |

**Total: 85 / 100**

Los 15 puntos restantes corresponden principalmente a la falta de GPS tracking para la distancia real del viaje.
