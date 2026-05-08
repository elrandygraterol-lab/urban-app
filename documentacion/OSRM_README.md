# OSRM Configuration for UrbanTaxi

## Overview
Este proyecto usa OSRM (Open Source Routing Machine) para cálculo de rutas optimizadas para taxis en Venezuela.

**IMPORTANTE:** OSRM ahora se ejecuta directamente en tu máquina (usando WSL2 en Windows) en lugar de Docker para evitar problemas de compatibilidad.

## Instalación Rápida

### 1. Instalar WSL2 y OSRM
Sigue la guía completa en `OSRM_WINDOWS_SETUP.md`

### 2. Iniciar Todo
```powershell
cd backend
.\start-dev.ps1
```

Este script:
- Inicia OSRM en WSL2 (puerto 5000)
- Inicia PostgreSQL y Redis en Docker
- Inicia el backend en Docker

## Configuración Manual

### Iniciar solo OSRM (en WSL2)
```bash
wsl ~/osrm-data/start-osrm.sh
```

### Iniciar servicios Docker (sin OSRM)
```powershell
cd backend
docker-compose up
```

## Características

### 🚗 **Perfil Optimizado para Taxis**
- Velocidades ajustadas para tráfico urbano
- Penalizaciones específicas para diferentes tipos de vías
- Soporte para carriles de taxi y bus
- Optimización para rutas urbanas cortas y medianas

### 🗺️ **Datos de Mapas**
- **Región**: Venezuela completa
- **Fuente**: OpenStreetMap via Geofabrik
- **Tamaño**: ~50MB comprimido
- **Actualización**: Los datos se descargan automáticamente en el primer inicio

### ⚡ **Rendimiento**
- Algoritmo MLD (Multi-Level Dijkstra) para routing rápido
- Soporte para hasta 1000 matching requests simultáneos
- Optimizado para consultas de routing frecuentes

## Configuración

### Variables de Entorno
```bash
# URL del servicio OSRM local
OSRM_URL=http://osrm:5000
```

### Puertos
- **5000**: API de OSRM (routing, matching, etc.)

## API Endpoints

### 🛣️ **Routing**
```
GET /route/v1/driving/{coordinates}
```
Calcula la ruta más rápida entre puntos.

**Ejemplo:**
```
http://localhost:5000/route/v1/driving/-66.9036,10.4806;-66.8792,10.5089?overview=full&geometries=geojson
```

### 📍 **Nearest**
```
GET /nearest/v1/driving/{coordinate}
```
Encuentra el punto más cercano en la red de carreteras.

### 🔍 **Match**
```
GET /match/v1/driving/{coordinates}
```
Hace map matching de coordenadas GPS a la red de carreteras.

### ℹ️ **Status**
```
GET /status
```
Verifica el estado del servicio.

## Primer Inicio

### ⏳ **Tiempo de Inicialización**
El primer inicio puede tomar **5-10 minutos** debido a:
1. Descarga de datos de mapas (~50MB)
2. Procesamiento y indexación de datos
3. Generación de estructuras de routing

### 📊 **Progreso**
Puedes monitorear el progreso con:
```bash
docker logs -f urbantaxi-osrm
```

### 🔄 **Reinicios Posteriores**
Los reinicios posteriores son **rápidos** (~30 segundos) ya que los datos procesados se mantienen en el volumen `osrm_data`.

## Configuración Avanzada

### 🛠️ **Perfil de Taxi** (`osrm-config/taxi.lua`)
El perfil incluye:

- **Velocidades por tipo de vía:**
  - Autopistas: 90 km/h
  - Vías principales: 70 km/h
  - Calles residenciales: 30 km/h
  - Vías de servicio: 20 km/h

- **Penalizaciones:**
  - Semáforos: +2 segundos
  - Cruces ferroviarios: +10 segundos
  - Giros en U: +20 segundos

- **Acceso especial:**
  - Carriles de taxi
  - Carriles de bus (cuando permitido)
  - Zonas de carga/descarga

### 🔧 **Personalización**
Para modificar el comportamiento:
1. Edita `osrm-config/taxi.lua`
2. Elimina el volumen: `docker volume rm backend_osrm_data`
3. Reinicia los servicios: `docker-compose up --build`

## Troubleshooting

### ❌ **Problemas Comunes**

**1. OSRM no inicia:**
```bash
# Verificar logs
docker logs urbantaxi-osrm

# Limpiar datos y reiniciar
docker volume rm backend_osrm_data
docker-compose up osrm
```

**2. Timeout en descarga:**
```bash
# Descargar manualmente
wget -O venezuela-latest.osm.pbf https://download.geofabrik.de/south-america/venezuela-latest.osm.pbf
```

**3. Memoria insuficiente:**
- Mínimo recomendado: 2GB RAM
- Para procesamiento inicial: 4GB RAM

### 🔍 **Verificar Estado**
```bash
# Estado del servicio
curl http://localhost:5000/status

# Prueba de routing
curl "http://localhost:5000/route/v1/driving/-66.9036,10.4806;-66.8792,10.5089?overview=full"
```

## Integración con Backend

### 📡 **Configuración Automática**
El backend está configurado para:
- Esperar a que OSRM esté listo antes de iniciar
- Usar el servicio local automáticamente
- Manejar timeouts y errores gracefully

### 🔄 **Fallback**
Si OSRM no está disponible, el backend:
- Continúa funcionando sin routing
- Registra warnings en los logs
- Puede configurarse para usar servicios externos

## Monitoreo

### 📊 **Métricas**
- Requests por segundo
- Tiempo de respuesta promedio
- Uso de memoria
- Estado de salud del servicio

### 🚨 **Alertas**
El sistema de alertas incluye:
- OSRM service down
- High response time
- Memory usage alerts

## Actualizaciones

### 🗺️ **Datos de Mapas**
Para actualizar los datos:
```bash
# Eliminar datos antiguos
docker volume rm backend_osrm_data

# Reiniciar para descargar nuevos datos
docker-compose up osrm
```

### 🔧 **Configuración**
Los cambios en `taxi.lua` requieren reprocesamiento:
```bash
docker volume rm backend_osrm_data
docker-compose up --build osrm
```

## Recursos

- [OSRM Documentation](http://project-osrm.org/)
- [OpenStreetMap Venezuela](https://www.openstreetmap.org/relation/272644)
- [Geofabrik Downloads](https://download.geofabrik.de/south-america/venezuela.html)