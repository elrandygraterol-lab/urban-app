# 🧪 Testing: OpenStreetMap + Nominatim + OSRM

**Guía para probar la implementación**

---

## 🚀 Requisitos Previos

### Backend corriendo
```bash
cd backend
npm install
npm run dev
# Backend en http://localhost:3000
```

### OSRM disponible
```bash
# Opción 1: Usar OSRM público (recomendado para testing)
# OSRM_URL=https://router.project-osrm.org

# Opción 2: Usar OSRM local (si está instalado)
# OSRM_URL=http://localhost:5000
```

---

## 🧪 Tests Manuales

### 1. Geocodificación (Dirección → Coordenadas)

**Request:**
```bash
curl -X POST http://localhost:3000/api/maps/geocode \
  -H "Content-Type: application/json" \
  -d '{
    "address": "Calle 5 #123, Bogotá, Colombia"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "latitude": 4.7110,
    "longitude": -74.0721,
    "address": "Calle 5, Bogotá, Colombia"
  }
}
```

**Casos de prueba:**
```bash
# Dirección en español
curl -X POST http://localhost:3000/api/maps/geocode \
  -H "Content-Type: application/json" \
  -d '{"address": "Plaza Mayor, Madrid, España"}'

# Dirección en inglés
curl -X POST http://localhost:3000/api/maps/geocode \
  -H "Content-Type: application/json" \
  -d '{"address": "Times Square, New York, USA"}'

# Dirección incompleta
curl -X POST http://localhost:3000/api/maps/geocode \
  -H "Content-Type: application/json" \
  -d '{"address": "Bogotá"}'

# Dirección inválida
curl -X POST http://localhost:3000/api/maps/geocode \
  -H "Content-Type: application/json" \
  -d '{"address": "xyzabc123notaplace"}'
```

---

### 2. Reverse Geocodificación (Coordenadas → Dirección)

**Request:**
```bash
curl -X POST http://localhost:3000/api/maps/reverse-geocode \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 4.7110,
    "longitude": -74.0721
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "latitude": 4.7110,
    "longitude": -74.0721,
    "address": "Calle 5, Bogotá, Colombia"
  }
}
```

**Casos de prueba:**
```bash
# Coordenadas válidas
curl -X POST http://localhost:3000/api/maps/reverse-geocode \
  -H "Content-Type: application/json" \
  -d '{"latitude": 40.7128, "longitude": -74.0060}'

# Coordenadas en el océano
curl -X POST http://localhost:3000/api/maps/reverse-geocode \
  -H "Content-Type: application/json" \
  -d '{"latitude": 0, "longitude": 0}'

# Coordenadas inválidas
curl -X POST http://localhost:3000/api/maps/reverse-geocode \
  -H "Content-Type: application/json" \
  -d '{"latitude": 91, "longitude": 181}'
```

---

### 3. Búsqueda de Lugares

**Request:**
```bash
curl "http://localhost:3000/api/maps/search-places?query=restaurantes&latitude=4.7110&longitude=-74.0721"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": [
    {
      "id": "123456",
      "name": "Restaurante XYZ",
      "description": "Restaurante XYZ, Calle 5, Bogotá",
      "latitude": 4.7115,
      "longitude": -74.0725,
      "type": "restaurant"
    },
    ...
  ]
}
```

**Casos de prueba:**
```bash
# Búsqueda con ubicación
curl "http://localhost:3000/api/maps/search-places?query=cafes&latitude=4.7110&longitude=-74.0721"

# Búsqueda sin ubicación
curl "http://localhost:3000/api/maps/search-places?query=hoteles"

# Búsqueda específica
curl "http://localhost:3000/api/maps/search-places?query=hospital%20san%20rafael"
```

---

### 4. Validación de Ubicación

**Request:**
```bash
curl -X POST http://localhost:3000/api/maps/validate-location \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 4.7110,
    "longitude": -74.0721
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "isValid": true
  }
}
```

---

### 5. Estimación de Viaje

**Request:**
```bash
curl "http://localhost:3000/api/maps/estimate?pickupLat=4.7110&pickupLng=-74.0721&dropoffLat=4.7200&dropoffLng=-74.0800&farePerKm=1.5&baseFare=2.0"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "distance": 1.23,
    "duration": 5,
    "estimatedCost": 3.85,
    "polyline": [[4.7110, -74.0721], [4.7115, -74.0725], ...]
  }
}
```

---

### 6. Ruta con Instrucciones

**Request:**
```bash
curl "http://localhost:3000/api/maps/route?pickupLat=4.7110&pickupLng=-74.0721&dropoffLat=4.7200&dropoffLng=-74.0800"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "distance": 1.23,
    "duration": 5,
    "polyline": [[4.7110, -74.0721], ...],
    "steps": [
      {
        "instruction": "Continuar en Calle 5",
        "distance": 0.5,
        "duration": 2,
        "name": "Calle 5"
      },
      ...
    ]
  }
}
```

---

### 7. Búsqueda de Conductores Cercanos

**Request:**
```bash
curl -X POST http://localhost:3000/api/maps/nearby-drivers \
  -H "Content-Type: application/json" \
  -d '{
    "passengerLocation": {
      "latitude": 4.7110,
      "longitude": -74.0721
    },
    "drivers": [
      {
        "driverId": "driver1",
        "location": {
          "latitude": 4.7115,
          "longitude": -74.0725
        }
      },
      {
        "driverId": "driver2",
        "location": {
          "latitude": 4.7200,
          "longitude": -74.0800
        }
      }
    ],
    "maxDistance": 5
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": [
    {
      "driverId": "driver1",
      "distance": 0.65,
      "duration": 2,
      "location": {
        "latitude": 4.7115,
        "longitude": -74.0725
      }
    },
    {
      "driverId": "driver2",
      "distance": 1.23,
      "duration": 5,
      "location": {
        "latitude": 4.7200,
        "longitude": -74.0800
      }
    }
  ]
}
```

---

### 8. Estado de Servicios

**Request:**
```bash
curl http://localhost:3000/api/maps/status
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "nominatim": {
      "status": "ok",
      "usage": {
        "requestsTotal": 42,
        "rateLimit": "1 request/segundo",
        "status": "Nominatim (OpenStreetMap) - Gratuito"
      }
    },
    "osrm": {
      "status": "ok",
      "mode": "public",
      "baseUrl": "https://router.project-osrm.org"
    }
  }
}
```

---

## 📊 Métricas de Rendimiento

### Velocidad Esperada

| Operación | Tiempo Esperado | Máximo Aceptable |
|-----------|-----------------|------------------|
| Geocoding | 100-200ms | 500ms |
| Reverse Geocoding | 100-200ms | 500ms |
| Búsqueda de lugares | 150-300ms | 500ms |
| Rutas | 150-400ms | 1000ms |
| Matriz de distancias | 200-600ms | 1000ms |

### Cómo medir

```bash
# Con curl y time
time curl -X POST http://localhost:3000/api/maps/geocode \
  -H "Content-Type: application/json" \
  -d '{"address": "Bogotá, Colombia"}'

# Con Apache Bench
ab -n 100 -c 10 http://localhost:3000/api/maps/status
```

---

## 🐛 Troubleshooting

### Error: "Nominatim service not available"
```
Solución: Verificar conexión a internet
curl https://nominatim.openstreetmap.org/status.php
```

### Error: "OSRM service not available"
```
Solución: Verificar OSRM_URL en .env
# Si usas OSRM público:
OSRM_URL=https://router.project-osrm.org

# Si usas OSRM local:
OSRM_URL=http://localhost:5000
```

### Error: "Rate limit exceeded"
```
Solución: Nominatim tiene límite de 1 request/segundo
Esperar 1 segundo entre requests
```

### Error: "Invalid coordinates"
```
Solución: Verificar rangos válidos
Latitud: -90 a 90
Longitud: -180 a 180
```

---

## ✅ Checklist de Testing

- [ ] Geocodificación funciona
- [ ] Reverse geocodificación funciona
- [ ] Búsqueda de lugares funciona
- [ ] Validación de ubicación funciona
- [ ] Estimación de viaje funciona
- [ ] Rutas con instrucciones funcionan
- [ ] Búsqueda de conductores cercanos funciona
- [ ] Estado de servicios funciona
- [ ] Velocidad < 500ms en todas las operaciones
- [ ] Precisión aceptable (±5-10 metros)
- [ ] Manejo de errores correcto
- [ ] Logging funciona correctamente

---

## 📝 Notas

- Nominatim tiene límite de 1 request/segundo (política de uso)
- OSRM público puede tener latencia variable
- Para producción, se recomienda OSRM autohospedado
- Todos los tests deben pasar antes de deploy

---

**Testing completado:** ✅ Marzo 15, 2026
