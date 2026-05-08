# Servicio de ETA - Guía de Uso Rápido

## Descripción

El servicio de ETA (Estimated Time of Arrival) calcula el tiempo estimado de llegada entre dos ubicaciones sin necesidad de usar APIs de pago como Google Maps Distance Matrix API.

## Características

✅ **Gratuito**: No requiere API keys ni tarjeta de crédito  
✅ **Fórmula de Haversine**: Cálculo preciso de distancias geográficas  
✅ **Tráfico simulado**: Ajusta velocidad según hora del día  
✅ **Integración WebSocket**: Actualizaciones automáticas en tiempo real  
✅ **Tests completos**: 23 tests unitarios + tests de integración  

## Uso Básico

### 1. Importar el servicio

```typescript
import { calculateETA, formatETA } from './services/etaService';
```

### 2. Calcular ETA

```typescript
const driverLocation = {
  latitude: 10.4806,
  longitude: -66.9036
};

const destination = {
  latitude: 10.5000,
  longitude: -66.9167
};

const eta = calculateETA(driverLocation, destination);

console.log(`ETA: ${eta.estimatedMinutes} minutos`);
console.log(`Distancia: ${eta.adjustedDistanceKm} km`);
console.log(`Velocidad: ${eta.averageSpeedKmh} km/h`);
console.log(formatETA(eta)); // "Llegada estimada en 15 minutos"
```

### 3. Resultado

```typescript
{
  estimatedMinutes: 15,        // Tiempo estimado en minutos
  distanceKm: 5.2,             // Distancia en línea recta
  adjustedDistanceKm: 6.76,    // Distancia ajustada (1.3x)
  averageSpeedKmh: 30,         // Velocidad promedio
  trafficFactor: 1.0,          // Factor de tráfico aplicado
  timestamp: Date              // Momento del cálculo
}
```

## Integración con WebSocket

El servicio se integra automáticamente con Socket.io para enviar actualizaciones de ETA al pasajero cada vez que el conductor actualiza su ubicación.

### Flujo Automático

1. **Conductor actualiza ubicación** (cada 5 segundos):
```typescript
socket.emit('driver:location_update', {
  rideId: 'ride-123',
  latitude: 10.4850,
  longitude: -66.9050
});
```

2. **Backend calcula ETA automáticamente** y emite:
```typescript
socket.emit('ride:eta_update', {
  rideId: 'ride-123',
  eta: {
    estimatedMinutes: 12,
    distanceKm: 5.8,
    averageSpeedKmh: 30,
    trafficFactor: 1.0,
    timestamp: '2024-01-15T10:30:00Z'
  },
  driverLocation: {
    latitude: 10.4850,
    longitude: -66.9050
  },
  targetType: 'pickup' // o 'destination'
});
```

3. **Pasajero recibe actualización**:
```typescript
socket.on('ride:eta_update', (data) => {
  console.log(`Conductor llegará en ${data.eta.estimatedMinutes} minutos`);
  // Actualizar UI
});
```

## Factores de Tráfico

El servicio ajusta la velocidad según la hora del día:

| Hora | Factor | Velocidad |
|------|--------|-----------|
| 7:00 - 9:00 (Hora pico mañana) | 0.5x | 15 km/h |
| 17:00 - 19:00 (Hora pico tarde) | 0.5x | 15 km/h |
| 12:00 - 14:00 (Mediodía) | 0.75x | 22.5 km/h |
| 22:00 - 6:00 (Noche) | 1.2x | 36 km/h |
| Resto del día | 1.0x | 30 km/h |

## Validaciones

El servicio valida automáticamente:

- ✅ Latitud: -90° a 90°
- ✅ Longitud: -180° a 180°
- ✅ Tipos de datos correctos
- ✅ Presencia de coordenadas

## Ejemplos de Uso

### Ejemplo 1: Viaje corto en ciudad

```typescript
const origin = { latitude: 10.4806, longitude: -66.9036 };
const destination = { latitude: 10.4900, longitude: -66.9100 };

const eta = calculateETA(origin, destination);
// Resultado: ~3-5 minutos
```

### Ejemplo 2: Viaje largo

```typescript
const caracas = { latitude: 10.4806, longitude: -66.9036 };
const maracay = { latitude: 10.2469, longitude: -67.5958 };

const eta = calculateETA(caracas, maracay);
// Resultado: ~180 minutos (3 horas)
```

### Ejemplo 3: Considerar hora pico

```typescript
// Durante hora pico (8:00 AM)
const eta = calculateETA(origin, destination);
// Velocidad: 15 km/h (50% de velocidad normal)
// ETA será el doble que en horario normal
```

## Testing

### Ejecutar tests unitarios

```bash
npm test -- etaService.test.ts
```

### Ejecutar tests de integración

```bash
npm test -- socketService.eta.test.ts
```

## Limitaciones

⚠️ **Esta es una implementación de desarrollo/prueba**

- No considera rutas reales (solo línea recta + factor 1.3x)
- Tráfico simulado (no datos reales)
- Velocidad constante (no considera tipo de vía)
- Optimizado para entornos urbanos

## Migración a Producción

Para producción, se recomienda migrar a una API real:

### Opción 1: Google Maps Distance Matrix API
```typescript
// Requiere API key y tarjeta de crédito
const response = await fetch(
  `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${API_KEY}`
);
```

### Opción 2: Mapbox Directions API
```typescript
// Alternativa a Google Maps
const response = await fetch(
  `https://api.mapbox.com/directions/v5/mapbox/driving/${origin};${destination}?access_token=${TOKEN}`
);
```

### Opción 3: OpenStreetMap + OSRM (Gratuito)
```typescript
// Completamente gratuito pero requiere servidor propio
const response = await fetch(
  `http://router.project-osrm.org/route/v1/driving/${origin};${destination}`
);
```

## Documentación Completa

Para más detalles, ver: `backend/docs/ETA_SERVICE.md`

## Soporte

Para preguntas o mejoras, contactar al equipo de desarrollo.
