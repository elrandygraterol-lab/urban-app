# Google Maps Distance Matrix API - Explicación y Alternativas

## ¿Qué es Distance Matrix API?

Distance Matrix API es un servicio de Google Maps que calcula distancias y tiempos de viaje entre múltiples puntos.

### Uso en UrbanTaxi
Se utiliza para:
- Calcular distancia entre pickup y destino
- Estimar tiempo de viaje (ETA)
- Calcular tarifa basada en distancia
- Ordenar conductores por distancia

---

## Problema: Requiere Tarjeta de Crédito

Google Maps API requiere:
1. Cuenta de Google Cloud
2. Proyecto creado
3. **Tarjeta de crédito registrada** (aunque sea tier gratuito)
4. Habilitar Distance Matrix API

### Límites Gratuitos
- 25,000 solicitudes/día
- $0.005 por solicitud después del límite gratuito

---

## Alternativas Gratuitas

### 1. OpenRouteService (Recomendado) ✅

**Ventajas**:
- Completamente gratuito
- No requiere tarjeta de crédito
- Open source
- Buena precisión

**Desventajas**:
- Límite: 40 solicitudes/minuto
- Menos preciso que Google en algunas áreas

**Implementación**:
```typescript
import axios from 'axios';

async function calculateDistance(pickup, destination) {
  const response = await axios.get(
    `https://api.openrouteservice.org/v2/matrix/driving-car`,
    {
      params: {
        api_key: process.env.OPENROUTE_API_KEY,
        locations: `${pickup.lng},${pickup.lat}|${destination.lng},${destination.lat}`
      }
    }
  );
  
  return {
    distance: response.data.distances[0][1] / 1000, // en km
    duration: response.data.durations[0][1] / 60 // en minutos
  };
}
```

**Registro**:
1. Ir a https://openrouteservice.org
2. Crear cuenta (gratis)
3. Obtener API key
4. Usar inmediatamente (sin tarjeta)

---

### 2. OSRM (Open Source Routing Machine)

**Ventajas**:
- Completamente gratuito
- Open source
- Puedes hospedar tu propio servidor
- Sin límites de API

**Desventajas**:
- Requiere configuración
- Menos preciso que Google
- Requiere mantenimiento

**Implementación**:
```typescript
async function calculateDistance(pickup, destination) {
  const response = await axios.get(
    `http://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${destination.lng},${destination.lat}`,
    {
      params: {
        overview: 'false'
      }
    }
  );
  
  return {
    distance: response.data.routes[0].distance / 1000, // en km
    duration: response.data.routes[0].duration / 60 // en minutos
  };
}
```

**Uso**:
1. Usar servidor público: `http://router.project-osrm.org`
2. O hospedar tu propio servidor

---

### 3. Mapbox Directions API

**Ventajas**:
- Gratuito (250,000 solicitudes/mes)
- Buena precisión
- No requiere tarjeta para tier gratuito

**Desventajas**:
- Requiere registro
- Límite mensual

**Implementación**:
```typescript
async function calculateDistance(pickup, destination) {
  const response = await axios.get(
    `https://api.mapbox.com/directions/geojson/v1/driving/${pickup.lng},${pickup.lat};${destination.lng},${destination.lat}`,
    {
      params: {
        access_token: process.env.MAPBOX_TOKEN
      }
    }
  );
  
  return {
    distance: response.data.features[0].properties.distance / 1000,
    duration: response.data.features[0].properties.duration / 60
  };
}
```

---

### 4. HERE Maps API

**Ventajas**:
- Gratuito (250,000 solicitudes/mes)
- Muy preciso
- Buena cobertura

**Desventajas**:
- Requiere registro
- Interfaz compleja

---

## Comparativa de Alternativas

| Servicio | Costo | Precisión | Límite Gratuito | Tarjeta Requerida |
|----------|-------|-----------|-----------------|-------------------|
| Google Maps | $0.005/req | Excelente | 25,000/día | ✅ Sí |
| OpenRouteService | Gratis | Buena | 40/min | ❌ No |
| OSRM | Gratis | Media | Ilimitado | ❌ No |
| Mapbox | Gratis | Excelente | 250k/mes | ❌ No |
| HERE Maps | Gratis | Excelente | 250k/mes | ❌ No |

---

## Recomendación para UrbanTaxi

### MVP (Ahora) - OpenRouteService ✅
```bash
# 1. Registrarse en https://openrouteservice.org
# 2. Obtener API key
# 3. Instalar dependencia
npm install axios

# 4. Configurar en .env
OPENROUTE_API_KEY=your_key_here
```

### Producción - Google Maps (con tarjeta)
```bash
# 1. Crear proyecto en Google Cloud
# 2. Habilitar Distance Matrix API
# 3. Registrar tarjeta de crédito
# 4. Usar API key
GOOGLE_MAPS_API_KEY=your_key_here
```

---

## Implementación en UrbanTaxi

### Servicio Genérico
```typescript
// services/distanceService.ts
export async function calculateDistance(pickup, destination) {
  const provider = process.env.DISTANCE_PROVIDER || 'openroute';
  
  if (provider === 'openroute') {
    return calculateWithOpenRoute(pickup, destination);
  } else if (provider === 'google') {
    return calculateWithGoogle(pickup, destination);
  } else if (provider === 'osrm') {
    return calculateWithOSRM(pickup, destination);
  }
}
```

### Uso en Rutas
```typescript
// routes/rides.ts
import { calculateDistance } from '@/services/distanceService';

router.post('/rides/request', async (req, res) => {
  const { pickup, destination } = req.body;
  
  const { distance, duration } = await calculateDistance(pickup, destination);
  const fare = calculateFare(distance, duration);
  
  res.json({ distance, duration, fare });
});
```

---

## Configuración Recomendada

### .env
```env
# Distance Provider: openroute, google, osrm, mapbox
DISTANCE_PROVIDER=openroute
OPENROUTE_API_KEY=your_key_here

# Fallback a OSRM si OpenRoute falla
OSRM_URL=http://router.project-osrm.org
```

### Manejo de Errores
```typescript
async function calculateDistance(pickup, destination) {
  try {
    // Intentar con OpenRoute
    return await calculateWithOpenRoute(pickup, destination);
  } catch (error) {
    console.warn('OpenRoute failed, trying OSRM...');
    // Fallback a OSRM
    return await calculateWithOSRM(pickup, destination);
  }
}
```

---

## Conclusión

**Para MVP sin tarjeta de crédito**: Usar **OpenRouteService**
- Gratuito
- Sin tarjeta requerida
- Suficiente precisión
- Fácil de implementar

**Para Producción**: Considerar **Google Maps** o **Mapbox**
- Mayor precisión
- Mejor soporte
- Escalabilidad garantizada

---

**Documento generado**: 15 de Marzo de 2026
**Versión**: 1.0
