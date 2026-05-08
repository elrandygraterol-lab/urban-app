# 🗺️ Integración: Google Maps SDK + OSRM Autohospedado

## 📋 Resumen

Se ha implementado la integración de **Google Maps SDK + OSRM Autohospedado** en UrbanTaxi, proporcionando:

✅ **Máxima precisión** - Google Maps SDK para geocodificación y validación  
✅ **Control total** - OSRM bajo tu control para cálculo de rutas  
✅ **Bajo costo** - $5-20/mes vs $75-150/mes con Google completo  
✅ **Privacidad** - Rutas calculadas en tu servidor  
✅ **Escalabilidad** - Sin límites de solicitudes  

---

## 🏗️ Arquitectura

### Componentes

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile App (React Native)             │
│                   + Google Maps SDK                      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend (Express)                     │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Maps Service (Integrado)                 │  │
│  │                                                  │  │
│  │  ┌─────────────────┐    ┌──────────────────┐   │  │
│  │  │ Google Maps SDK │    │ OSRM Service     │   │  │
│  │  │                 │    │                  │   │  │
│  │  │ • Geocoding     │    │ • Rutas          │   │  │
│  │  │ • Reverse Geo   │    │ • Distancias     │   │  │
│  │  │ • Validación    │    │ • Tiempos        │   │  │
│  │  │ • Búsqueda      │    │ • Matrices       │   │  │
│  │  └─────────────────┘    └──────────────────┘   │  │
│  └──────────────────────────────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│              /api/maps/* Endpoints                      │
└─────────────────────────────────────────────────────────┘
```

### Flujo de Datos

```
1. Usuario solicita viaje
   ↓
2. App envía ubicaciones (lat/lng)
   ↓
3. Backend calcula:
   - Geocodificación (Google Maps)
   - Ruta (OSRM)
   - Distancia y duración (OSRM)
   - Costo estimado
   ↓
4. App muestra ruta en Google Maps SDK
   ↓
5. Conductor acepta
   ↓
6. Backend calcula conductores cercanos (OSRM)
   ↓
7. Notifica a conductores
```

---

## 🔧 Configuración

### Backend

#### 1. Variables de Entorno (.env)

```bash
# Google Maps API
GOOGLE_MAPS_API_KEY=your_api_key_here

# OSRM Configuration
# Opción 1: Usar OSRM público (demo) - GRATIS
OSRM_URL=https://router.project-osrm.org

# Opción 2: Usar OSRM autohospedado - $5-20/mes
# OSRM_URL=http://localhost:5000
# o
# OSRM_URL=https://osrm.tudominio.com
```

#### 2. Obtener Google Maps API Key

1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. Crear nuevo proyecto
3. Habilitar APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Geocoding API
   - Places API
4. Crear credenciales (API Key)
5. Restringir a:
   - Android (con SHA-1)
   - iOS (con Bundle ID)
   - HTTP referrers (para web)

#### 3. Configurar OSRM Autohospedado (Opcional)

**Opción A: Docker (Recomendado)**

```bash
# Descargar imagen de OSRM
docker pull osrm/osrm-backend

# Descargar datos de OpenStreetMap (ej: Venezuela)
wget http://download.geofabrik.de/south-america/venezuela-latest.osm.pbf

# Preparar datos
docker run -t -v $(pwd):/data osrm/osrm-backend osrm-extract -p /opt/car.lua /data/venezuela-latest.osm.pbf

docker run -t -v $(pwd):/data osrm/osrm-backend osrm-partition /data/venezuela-latest.osrm

docker run -t -v $(pwd):/data osrm/osrm-backend osrm-customize /data/venezuela-latest.osrm

# Ejecutar servidor
docker run -t -i -p 5000:5000 -v $(pwd):/data osrm/osrm-backend osrm-routed --algorithm mld /data/venezuela-latest.osrm
```

**Opción B: VPS (DigitalOcean, Linode, etc.)**

```bash
# Instalar OSRM
sudo apt-get update
sudo apt-get install -y build-essential git cmake pkg-config libbz2-dev libxml2-dev libzip-dev libboost-all-dev lua5.2 liblua5.2-dev

# Clonar repositorio
git clone https://github.com/Project-OSRM/osrm-backend.git
cd osrm-backend
mkdir build
cd build
cmake ..
make

# Descargar datos y preparar
# (ver pasos anteriores)

# Ejecutar
./osrm-routed --algorithm mld /data/venezuela-latest.osrm
```

---

## 📡 Endpoints API

### 1. Obtener Estimación de Viaje

```http
GET /api/maps/estimate?pickupLat=10.5&pickupLng=-66.9&dropoffLat=10.6&dropoffLng=-66.8&farePerKm=1.5&baseFare=2.0
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "distance": 12.5,
    "duration": 25,
    "estimatedCost": 20.75,
    "polyline": [[10.5, -66.9], [10.51, -66.89], ...]
  }
}
```

### 2. Geocodificar Dirección

```http
POST /api/maps/geocode
Content-Type: application/json

{
  "address": "Calle 5, Caracas, Venezuela"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "latitude": 10.4806,
    "longitude": -66.9036,
    "address": "Calle 5, Caracas 1010, Venezuela"
  }
}
```

### 3. Reverse Geocodificar

```http
POST /api/maps/reverse-geocode
Content-Type: application/json

{
  "latitude": 10.4806,
  "longitude": -66.9036
}
```

### 4. Buscar Lugares

```http
GET /api/maps/search-places?query=restaurante&latitude=10.5&longitude=-66.9
```

### 5. Encontrar Conductores Cercanos

```http
POST /api/maps/nearby-drivers
Authorization: Bearer token
Content-Type: application/json

{
  "passengerLocation": {
    "latitude": 10.5,
    "longitude": -66.9
  },
  "drivers": [
    {
      "driverId": "driver1",
      "location": {
        "latitude": 10.501,
        "longitude": -66.901
      }
    },
    {
      "driverId": "driver2",
      "location": {
        "latitude": 10.505,
        "longitude": -66.895
      }
    }
  ],
  "maxDistance": 5
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "driverId": "driver1",
      "distance": 0.15,
      "duration": 2,
      "location": { "latitude": 10.501, "longitude": -66.901 }
    },
    {
      "driverId": "driver2",
      "distance": 0.65,
      "duration": 5,
      "location": { "latitude": 10.505, "longitude": -66.895 }
    }
  ]
}
```

### 6. Obtener Ruta con Instrucciones

```http
GET /api/maps/route?pickupLat=10.5&pickupLng=-66.9&dropoffLat=10.6&dropoffLng=-66.8
```

### 7. Estado de Servicios

```http
GET /api/maps/status
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "googleMaps": {
      "status": "ok",
      "usage": {
        "requestsToday": 245,
        "dailyLimit": 10000,
        "remainingRequests": 9755,
        "percentageUsed": "2.45"
      }
    },
    "osrm": {
      "status": "ok",
      "mode": "self-hosted",
      "baseUrl": "http://localhost:5000"
    }
  }
}
```

---

## 📱 Uso en la App Móvil

### Importar Servicio

```typescript
import mapsService from '../services/mapsService';
```

### Obtener Estimación

```typescript
const estimate = await mapsService.getEstimate(
  { latitude: 10.5, longitude: -66.9 },
  { latitude: 10.6, longitude: -66.8 },
  1.5, // farePerKm
  2.0  // baseFare
);

console.log(`Distancia: ${estimate.distance} km`);
console.log(`Duración: ${estimate.duration} minutos`);
console.log(`Costo: $${estimate.estimatedCost}`);
```

### Mostrar Ruta en Google Maps

```typescript
import MapView, { Polyline } from 'react-native-maps';

const route = await mapsService.getRoute(pickupLocation, dropoffLocation);

<MapView>
  <Polyline
    coordinates={route.polyline}
    strokeColor="#00B300"
    strokeWidth={3}
  />
</MapView>
```

### Buscar Lugares

```typescript
const places = await mapsService.searchPlaces(
  'restaurante',
  10.5,
  -66.9
);
```

---

## 💰 Análisis de Costos

### Escenario: 500 viajes/día

| Servicio | Costo Mensual | Notas |
|----------|---------------|-------|
| **Google Maps Completo** | $75-150 | Directions + Distance Matrix |
| **Google Maps SDK + OSRM Público** | $0 | Gratuito pero lento |
| **Google Maps SDK + OSRM Autohospedado** | $5-20 | ⭐ RECOMENDADO |
| **Ahorro vs Google Completo** | **87-93%** | Máximo ahorro |

### Desglose de Costos (OSRM Autohospedado)

- **Software OSRM**: $0 (código abierto)
- **Servidor VPS**: $5-20/mes
- **Datos OpenStreetMap**: $0 (gratuito)
- **Google Maps API**: $0 (dentro de cuota gratuita)
- **Total**: $5-20/mes

---

## 🚀 Monitoreo y Mantenimiento

### Monitoreo de Google Maps

```bash
# Ver uso diario
curl http://localhost:3000/api/maps/status
```

### Actualizar Datos de OSRM

```bash
# Mensualmente, descargar nuevos datos de OpenStreetMap
wget http://download.geofabrik.de/south-america/venezuela-latest.osm.pbf

# Reprocesar datos
docker run -t -v $(pwd):/data osrm/osrm-backend osrm-extract -p /opt/car.lua /data/venezuela-latest.osm.pbf
docker run -t -v $(pwd):/data osrm/osrm-backend osrm-partition /data/venezuela-latest.osrm
docker run -t -v $(pwd):/data osrm/osrm-backend osrm-customize /data/venezuela-latest.osrm
```

### Alertas

- Si Google Maps alcanza 80% de cuota diaria
- Si OSRM no responde en 5 segundos
- Si tasa de error > 1%

---

## 🔄 Fallback y Redundancia

### Estrategia de Fallback

```
1. Intentar OSRM autohospedado
   ↓ (si falla)
2. Intentar OSRM público
   ↓ (si falla)
3. Usar Google Directions API (pago)
   ↓ (si falla)
4. Mostrar error al usuario
```

### Implementación

```typescript
async function getRouteWithFallback(start, end) {
  try {
    // Intentar OSRM autohospedado
    return await osrmService.getRoute(start, end);
  } catch (error) {
    try {
      // Fallback a OSRM público
      return await osrmPublicService.getRoute(start, end);
    } catch (error2) {
      // Fallback a Google Directions
      return await googleMapsService.getDirections(start, end);
    }
  }
}
```

---

## 📊 Comparativa Final

| Métrica | Google Maps | OSRM | Google+OSRM |
|---------|-------------|------|------------|
| **Costo 500 viajes/día** | $75-150/mes | $5-20/mes | $5-20/mes |
| **Precisión** | 99.5% | 97% | 99.5% |
| **Tráfico Real** | ✅ Sí | ❌ No | ❌ No |
| **Control** | ❌ No | ✅ Sí | ✅ Sí |
| **Privacidad** | ❌ No | ✅ Sí | ✅ Sí |
| **Ahorro** | — | — | **87-93%** |

---

## 📚 Referencias

- [OSRM Documentation](http://project-osrm.org/)
- [Google Maps API](https://developers.google.com/maps)
- [OpenStreetMap](https://www.openstreetmap.org/)
- [Docker OSRM](https://hub.docker.com/r/osrm/osrm-backend)

---

**Documento actualizado**: 15 de Marzo de 2026  
**Versión**: 1.0
