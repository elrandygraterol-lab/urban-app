# 🏗️ Arquitectura: Google Maps SDK + OSRM

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React Native)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              MapView Component                       │  │
│  │  - Visualización de mapa (Google Maps SDK)          │  │
│  │  - Marcadores (pickup, dropoff, driver)             │  │
│  │  - Polilíneas de rutas                              │  │
│  │  - Ubicación del usuario en tiempo real             │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ▲                                  │
│                           │ HTTP/REST                        │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              API Service (axios)                     │  │
│  │  - /api/maps/estimate                               │  │
│  │  - /api/maps/geocode                                │  │
│  │  - /api/maps/reverse-geocode                        │  │
│  │  - /api/maps/search-places                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │ HTTP/REST
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js/Express)                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Maps Controller                         │  │
│  │  - Endpoints REST para servicios de mapas           │  │
│  │  - Validación de parámetros                         │  │
│  │  - Manejo de errores                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Maps Service                            │  │
│  │  - Orquestación de servicios                        │  │
│  │  - Lógica de negocio                                │  │
│  │  - Caché de resultados                              │  │
│  └──────────────────────────────────────────────────────┘  │
│           ▲                                    ▲             │
│           │                                    │             │
│    ┌──────┴──────┐                    ┌───────┴────────┐   │
│    ▼             ▼                    ▼                ▼   │
│  ┌──────────────────────┐    ┌──────────────────────┐     │
│  │ Google Maps Service  │    │   OSRM Service       │     │
│  │ - Geocodificación    │    │ - Cálculo de rutas   │     │
│  │ - Reverse geocoding  │    │ - Matriz de distancias│    │
│  │ - Búsqueda de lugares│    │ - Instrucciones      │     │
│  │ - Validación         │    │ - Polilíneas         │     │
│  └──────────────────────┘    └──────────────────────┘     │
│           ▲                                    ▲             │
│           │ HTTPS                             │ HTTP        │
│           ▼                                    ▼             │
│  ┌──────────────────────┐    ┌──────────────────────┐     │
│  │  Google Maps API     │    │   OSRM Server        │     │
│  │  - Geocoding API     │    │ - Público o          │     │
│  │  - Places API        │    │   Autohospedado      │     │
│  │  - Maps SDK          │    │                      │     │
│  └──────────────────────┘    └──────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Flujo de Datos

### 1. Obtener Estimación de Viaje
```
Usuario selecciona pickup/dropoff
         ▼
Frontend: /api/maps/estimate
         ▼
Backend: mapsService.getEstimate()
         ▼
OSRM: Calcula ruta y distancia
         ▼
Backend: Calcula costo estimado
         ▼
Frontend: Muestra estimación y ruta
```

### 2. Geocodificar Dirección
```
Usuario ingresa dirección
         ▼
Frontend: /api/maps/geocode
         ▼
Backend: googleMapsService.geocodeAddress()
         ▼
Google Maps API: Convierte dirección a coordenadas
         ▼
Backend: Retorna coordenadas
         ▼
Frontend: Muestra marcador en mapa
```

### 3. Buscar Lugares
```
Usuario busca lugar
         ▼
Frontend: /api/maps/search-places
         ▼
Backend: googleMapsService.searchPlaces()
         ▼
Google Maps API: Busca lugares
         ▼
Backend: Retorna lista de lugares
         ▼
Frontend: Muestra sugerencias
```

## Componentes Principales

### Frontend
- **MapView.tsx** - Componente principal de mapa
- **API Service** - Cliente HTTP para backend

### Backend
- **googleMapsService.ts** - Integración con Google Maps
- **osrmService.ts** - Integración con OSRM
- **mapsService.ts** - Orquestación de servicios
- **mapsController.ts** - Endpoints REST
- **mapsRoutes.ts** - Definición de rutas

## Flujo de Autenticación

```
Google Cloud Console
         ▼
Crear API Key
         ▼
Configurar restricciones
         ▼
Agregar a variables de entorno
         ▼
Backend/Frontend: Usar API Key en requests
         ▼
Google Maps API: Valida y procesa request
```

## Escalabilidad

### Horizontal
- Frontend: Múltiples instancias con load balancer
- Backend: Múltiples instancias con load balancer
- OSRM: Múltiples instancias con load balancer

### Vertical
- Aumentar recursos de servidor
- Optimizar queries a Google Maps
- Implementar caché agresivo

## Seguridad

```
┌─────────────────────────────────────────┐
│         API Key Management              │
├─────────────────────────────────────────┤
│ ✅ Almacenar en variables de entorno    │
│ ✅ Nunca commitear en Git               │
│ ✅ Restringir por aplicación            │
│ ✅ Rotar regularmente                   │
│ ✅ Monitorear uso                       │
└─────────────────────────────────────────┘
```

## Monitoreo

```
┌─────────────────────────────────────────┐
│      Google Cloud Console               │
├─────────────────────────────────────────┤
│ - Monitorear uso de API                 │
│ - Configurar alertas de cuota           │
│ - Revisar costos                        │
│ - Analizar errores                      │
└─────────────────────────────────────────┘
```

## Tecnologías

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React Native | 0.81.5 |
| Frontend | Expo | 54.0.33 |
| Frontend | react-native-maps | 1.27.2 |
| Backend | Node.js | 18+ |
| Backend | Express | 4.x |
| Backend | TypeScript | 5.9.2 |
| Mapas | Google Maps SDK | Latest |
| Rutas | OSRM | Latest |
| Base de Datos | PostgreSQL | 12+ |
| Cache | Redis | 6+ |
