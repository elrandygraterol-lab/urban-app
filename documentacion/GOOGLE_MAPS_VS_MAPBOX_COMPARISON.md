# 🗺️ Comparativa: Google Maps vs Mapbox + OSRM

## 📊 Tabla Comparativa General

| Aspecto | Google Maps SDK | Mapbox | Ventaja |
|--------|-----------------|--------|---------|
| **Costo Mensual** | $0-150+ | $0-5 | Mapbox ✅ |
| **Precisión** | ⭐⭐⭐⭐⭐ (99.5%) | ⭐⭐⭐⭐ (98%) | Google ✅ |
| **Tarjeta Requerida** | ✅ Sí | ❌ No | Mapbox ✅ |
| **Código Abierto** | ❌ No | ❌ No | Empate |
| **Personalización** | Media | ⭐⭐⭐⭐⭐ Excelente | Mapbox ✅ |
| **Tráfico Real** | ✅ Sí | ✅ Sí | Empate |
| **Documentación** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Google ✅ |
| **Comunidad** | ⭐⭐⭐⭐⭐ Grande | ⭐⭐⭐⭐ Buena | Google ✅ |
| **Rendimiento** | Excelente | Excelente | Empate |
| **Soporte** | Profesional | Profesional | Empate |
| **Escalabilidad** | Excelente | Excelente | Empate |
| **Offline Maps** | ❌ No | ✅ Sí | Mapbox ✅ |
| **Estilos Personalizados** | Limitados | Ilimitados | Mapbox ✅ |
| **Datos de Mapas** | Google | OpenStreetMap | Depende |

---

## 🔍 Análisis Detallado

### 1. GOOGLE MAPS SDK

#### ✅ Ventajas

- **Máxima Precisión**: 99.5% de precisión en ubicaciones
- **Tráfico Real**: Datos de tráfico en tiempo real
- **Cobertura Global**: Excelente cobertura en todo el mundo
- **Documentación**: Documentación muy completa
- **Comunidad**: Comunidad muy grande
- **Integración**: Fácil integración con otros servicios de Google
- **Rendimiento**: Muy rápido y optimizado
- **Soporte**: Soporte profesional disponible

#### ❌ Desventajas

- **Costo**: Puede ser muy caro ($75-150/mes con alto volumen)
- **Tarjeta Requerida**: Necesita tarjeta de crédito
- **Privacidad**: Google ve todas tus solicitudes
- **Personalización**: Opciones de personalización limitadas
- **Dependencia**: Dependes de Google
- **Límites**: Límites de solicitudes por día
- **Datos**: No puedes usar datos offline

#### 💰 Precios

```
Tier Gratuito:
- 10,000 solicitudes/mes gratis
- Después: $5 por cada 1,000 solicitudes

Ejemplo (500 viajes/día):
- 500 viajes × 30 días = 15,000 solicitudes/mes
- 10,000 gratis + 5,000 pagadas
- 5,000 ÷ 1,000 × $5 = $25/mes
- Total: $25/mes (dentro de cuota gratuita)

Ejemplo (1,000 viajes/día):
- 1,000 viajes × 30 días = 30,000 solicitudes/mes
- 10,000 gratis + 20,000 pagadas
- 20,000 ÷ 1,000 × $5 = $100/mes
- Total: $100/mes
```

---

### 2. MAPBOX

#### ✅ Ventajas

- **Costo**: Muy económico ($0-5/mes para la mayoría de casos)
- **Sin Tarjeta**: Tier gratuito sin tarjeta de crédito
- **Personalización**: Estilos completamente personalizables
- **Offline Maps**: Soporte para mapas offline
- **Código Abierto**: Usa OpenStreetMap (datos abiertos)
- **Flexibilidad**: Mucha más flexibilidad que Google
- **Privacidad**: Mejor privacidad que Google
- **Documentación**: Documentación muy buena
- **Rendimiento**: Muy rápido y optimizado

#### ❌ Desventajas

- **Precisión**: 98% (ligeramente menos que Google)
- **Tráfico Real**: Tráfico real disponible pero con costo adicional
- **Cobertura**: Cobertura ligeramente menor en algunas áreas
- **Comunidad**: Comunidad más pequeña que Google
- **Datos**: Depende de OpenStreetMap (puede tener gaps)
- **Límites**: Límites de solicitudes por mes
- **Soporte**: Soporte menos robusto que Google

#### 💰 Precios

```
Tier Gratuito:
- 50,000 solicitudes/mes gratis
- Mapas: Ilimitados
- Geocoding: 600 solicitudes/mes
- Direcciones: 100 solicitudes/mes

Tier Pay-As-You-Go:
- $0.50 por cada 1,000 solicitudes adicionales
- Mapas: Ilimitados
- Geocoding: $0.50 por 1,000
- Direcciones: $0.50 por 1,000

Tier Pro ($5/mes):
- 500,000 solicitudes/mes
- Mapas: Ilimitados
- Geocoding: 10,000/mes
- Direcciones: 1,000/mes

Ejemplo (500 viajes/día):
- 500 viajes × 30 días = 15,000 solicitudes/mes
- 50,000 gratis (dentro de límite)
- Total: $0/mes ✅

Ejemplo (1,000 viajes/día):
- 1,000 viajes × 30 días = 30,000 solicitudes/mes
- 50,000 gratis (dentro de límite)
- Total: $0/mes ✅

Ejemplo (2,000 viajes/día):
- 2,000 viajes × 30 días = 60,000 solicitudes/mes
- 50,000 gratis + 10,000 pagadas
- 10,000 ÷ 1,000 × $0.50 = $5/mes
- Total: $5/mes ✅
```

---

### 3. COMPARATIVA LADO A LADO

#### Características de Mapas

| Característica | Google Maps | Mapbox |
|---|---|---|
| **Visualización de Mapas** | ✅ Excelente | ✅ Excelente |
| **Geocodificación** | ✅ Excelente | ✅ Muy Buena |
| **Rutas/Direcciones** | ✅ Excelente | ✅ Muy Buena |
| **Búsqueda de Lugares** | ✅ Excelente | ✅ Buena |
| **Tráfico Real** | ✅ Sí | ✅ Sí (pago) |
| **Mapas Offline** | ❌ No | ✅ Sí |
| **Estilos Personalizados** | ⚠️ Limitados | ✅ Ilimitados |
| **Datos de Mapas** | Google | OpenStreetMap |

#### Casos de Uso

| Caso | Recomendación | Razón |
|---|---|---|
| **MVP sin presupuesto** | Mapbox | Gratuito, sin tarjeta |
| **Máxima precisión** | Google Maps | 99.5% vs 98% |
| **Máximo ahorro** | Mapbox | $0-5/mes |
| **Personalización** | Mapbox | Estilos ilimitados |
| **Tráfico real crítico** | Google Maps | Mejor cobertura |
| **Privacidad importante** | Mapbox | Mejor privacidad |
| **Escalado masivo** | Mapbox | Más económico |

---

## 🔄 Migración: Google Maps → Mapbox

### Paso 1: Cambios en Backend

#### Crear `mapboxService.ts`

```typescript
// Reemplaza googleMapsService.ts
import axios from 'axios';
import config from '../config';

class MapboxService {
  private apiKey: string;
  private baseUrl = 'https://api.mapbox.com';

  constructor() {
    this.apiKey = config.mapboxApiKey || '';
  }

  async geocodeAddress(address: string) {
    const response = await axios.get(
      `${this.baseUrl}/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`,
      {
        params: {
          access_token: this.apiKey,
          limit: 1,
        },
      }
    );

    const feature = response.data.features[0];
    return {
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
      formattedAddress: feature.place_name,
    };
  }

  async reverseGeocode(latitude: number, longitude: number) {
    const response = await axios.get(
      `${this.baseUrl}/geocoding/v5/mapbox.places/${longitude},${latitude}.json`,
      {
        params: {
          access_token: this.apiKey,
        },
      }
    );

    const feature = response.data.features[0];
    return {
      latitude,
      longitude,
      formattedAddress: feature.place_name,
    };
  }

  // ... más métodos
}
```

#### Actualizar `config/index.ts`

```typescript
// Cambiar de:
googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',

// A:
mapboxApiKey: process.env.MAPBOX_API_KEY || '',
```

#### Actualizar `.env`

```bash
# Cambiar de:
GOOGLE_MAPS_API_KEY=

# A:
MAPBOX_API_KEY=your_mapbox_token
```

### Paso 2: Cambios en App Móvil

#### Instalar Dependencias

```bash
npm install @react-native-mapbox-gl/maps
# o
npm install react-native-mapbox-gl
```

#### Actualizar `app/package.json`

```json
{
  "dependencies": {
    "react-native-maps": "^1.27.2",  // Mantener para compatibilidad
    "@react-native-mapbox-gl/maps": "^8.6.0"  // Agregar Mapbox
  }
}
```

#### Cambiar Componente de Mapa

```typescript
// Antes (Google Maps):
import MapView, { Polyline } from 'react-native-maps';

<MapView
  style={{ flex: 1 }}
  initialRegion={{
    latitude: 10.5,
    longitude: -66.9,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  }}
>
  <Polyline coordinates={route} strokeColor="#00B300" strokeWidth={3} />
</MapView>

// Después (Mapbox):
import MapboxGL from '@react-native-mapbox-gl/maps';

MapboxGL.setAccessToken('your_mapbox_token');

<MapboxGL.MapView style={{ flex: 1 }}>
  <MapboxGL.Camera
    zoomLevel={13}
    centerCoordinate={[-66.9, 10.5]}
  />
  <MapboxGL.ShapeSource id="route" shape={{ type: 'LineString', coordinates: route }}>
    <MapboxGL.LineLayer
      id="routeLine"
      style={{
        lineColor: '#00B300',
        lineWidth: 3,
      }}
    />
  </MapboxGL.ShapeSource>
</MapboxGL.MapView>
```

### Paso 3: Cambios en Servicio de Mapas

#### Actualizar `app/services/mapsService.ts`

```typescript
// Cambiar de googleMapsService a mapboxService
import { mapboxService } from '../services/mapboxService';

export async function geocodeAddress(address: string) {
  const result = await mapboxService.geocodeAddress(address);
  return result;
}
```

---

## 📈 Análisis de Costos: Google Maps vs Mapbox

### Escenario 1: MVP (50 viajes/día)

| Servicio | Costo Mensual | Notas |
|----------|---------------|-------|
| Google Maps SDK + OSRM | $5-20 | OSRM autohospedado |
| Mapbox + OSRM | $0 | Mapbox gratuito |
| **Ahorro con Mapbox** | **$5-20/mes** | 100% gratis |

### Escenario 2: Crecimiento (200 viajes/día)

| Servicio | Costo Mensual | Notas |
|----------|---------------|-------|
| Google Maps SDK + OSRM | $5-20 | OSRM autohospedado |
| Mapbox + OSRM | $0 | Mapbox gratuito |
| **Ahorro con Mapbox** | **$5-20/mes** | 100% gratis |

### Escenario 3: Escalado (500 viajes/día)

| Servicio | Costo Mensual | Notas |
|----------|---------------|-------|
| Google Maps SDK + OSRM | $5-20 | OSRM autohospedado |
| Mapbox + OSRM | $0 | Mapbox gratuito (50k solicitudes) |
| **Ahorro con Mapbox** | **$5-20/mes** | 100% gratis |

### Escenario 4: Producción (1,000 viajes/día)

| Servicio | Costo Mensual | Notas |
|----------|---------------|-------|
| Google Maps SDK + OSRM | $5-20 | OSRM autohospedado |
| Mapbox + OSRM | $0-5 | Mapbox Pro ($5/mes) |
| **Ahorro con Mapbox** | **$0-20/mes** | Muy económico |

### Escenario 5: Masivo (2,000 viajes/día)

| Servicio | Costo Mensual | Notas |
|----------|---------------|-------|
| Google Maps SDK + OSRM | $5-20 | OSRM autohospedado |
| Mapbox + OSRM | $5 | Mapbox Pro ($5/mes) |
| **Ahorro con Mapbox** | **$0-15/mes** | Muy económico |

---

## 🎯 Recomendación

### Usar Google Maps Si:
- ✅ Necesitas máxima precisión (99.5%)
- ✅ Tráfico real es crítico
- ✅ Tienes presupuesto disponible
- ✅ Necesitas máximo soporte

### Usar Mapbox Si:
- ✅ Quieres máximo ahorro ($0-5/mes)
- ✅ Necesitas personalización de estilos
- ✅ Quieres mapas offline
- ✅ Privacidad es importante
- ✅ Prefieres datos abiertos (OpenStreetMap)
- ✅ Escalas a alto volumen

### Recomendación Final para UrbanTaxi

**Opción A: Máximo Ahorro** ⭐ RECOMENDADO
- Mapbox + OSRM Autohospedado
- Costo: $5-20/mes (solo OSRM)
- Precisión: 98% (muy buena)
- Personalización: Excelente

**Opción B: Máxima Precisión**
- Google Maps SDK + OSRM Autohospedado
- Costo: $5-20/mes (solo OSRM)
- Precisión: 99.5% (excelente)
- Personalización: Media

**Opción C: Híbrida**
- Mapbox para visualización
- Google Geocoding para precisión
- OSRM para rutas
- Costo: $5-20/mes

---

## 📋 Tabla de Migración

| Componente | Google Maps | Mapbox | Esfuerzo |
|---|---|---|---|
| **Geocodificación** | `googleMapsService.geocodeAddress()` | `mapboxService.geocodeAddress()` | Bajo |
| **Reverse Geocode** | `googleMapsService.reverseGeocode()` | `mapboxService.reverseGeocode()` | Bajo |
| **Búsqueda de Lugares** | `googleMapsService.searchPlaces()` | `mapboxService.searchPlaces()` | Bajo |
| **Componente de Mapa** | `<MapView>` | `<MapboxGL.MapView>` | Medio |
| **Polyline** | `<Polyline>` | `<MapboxGL.ShapeSource>` | Medio |
| **Marcadores** | `<Marker>` | `<MapboxGL.PointAnnotation>` | Bajo |
| **Configuración** | `GOOGLE_MAPS_API_KEY` | `MAPBOX_API_KEY` | Bajo |

---

## 🔄 Estrategia de Migración Recomendada

### Fase 1: Preparación (1-2 días)
1. Crear cuenta en Mapbox
2. Obtener token de acceso
3. Crear `mapboxService.ts`
4. Crear tests para mapboxService

### Fase 2: Backend (2-3 días)
1. Actualizar `mapsService.ts` para usar Mapbox
2. Actualizar configuración
3. Actualizar endpoints
4. Probar endpoints

### Fase 3: App Móvil (3-5 días)
1. Instalar dependencias de Mapbox
2. Actualizar componentes de mapa
3. Actualizar servicio de mapas
4. Probar en Android e iOS

### Fase 4: Testing (2-3 días)
1. Testing de geocodificación
2. Testing de rutas
3. Testing de búsqueda de lugares
4. Testing de rendimiento

### Fase 5: Deployment (1 día)
1. Deploy a staging
2. Testing en staging
3. Deploy a producción

**Tiempo Total: 1-2 semanas**

---

## 📚 Referencias

- [Mapbox Documentation](https://docs.mapbox.com/)
- [Mapbox Pricing](https://www.mapbox.com/pricing/)
- [React Native Mapbox GL](https://github.com/react-native-mapbox-gl/maps)
- [Mapbox Geocoding API](https://docs.mapbox.com/api/search/geocoding/)
- [OpenStreetMap](https://www.openstreetmap.org/)

---

**Documento actualizado**: 15 de Marzo de 2026  
**Versión**: 1.0
