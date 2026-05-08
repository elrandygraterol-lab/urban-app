# 🗺️ Guía de Migración: Mapbox → Google Maps SDK + OSRM

## 📋 Resumen de Cambios

Se ha completado la migración de **Mapbox** a **Google Maps SDK** (Android e iOS) + **OSRM** para rutas.

### ✅ Cambios Realizados

#### Backend
- ✅ Nuevo servicio: `backend/src/services/googleMapsService.ts`
- ✅ Actualizado: `backend/src/services/mapsService.ts` (ahora usa Google Maps)
- ✅ Actualizado: `backend/src/config/index.ts` (MAPBOX_API_KEY → GOOGLE_MAPS_API_KEY)
- ✅ Actualizado: `.env` y `.env.example` (variables de entorno)

#### Frontend
- ✅ Actualizado: `app/src/components/MapView.tsx` (Mapbox GL → Google Maps SDK)
- ✅ Actualizado: `app/jest.config.js` (removido mock de Mapbox)
- ✅ Actualizado: `app/.env` y `app/.env.example` (variables de entorno)
- ✅ Actualizado: `app/app.json` (configuración de Google Maps)

---

## 🔧 Configuración Requerida

### 1. Obtener Google Maps API Key

#### Para Android:
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita las siguientes APIs:
   - Maps SDK for Android
   - Geocoding API
   - Places API
4. Crea una credencial de tipo "API Key"
5. Restringe la clave a Android y especifica tu SHA-1 fingerprint

#### Para iOS:
1. En el mismo proyecto de Google Cloud
2. Habilita las mismas APIs
3. Crea otra credencial de tipo "API Key"
4. Restringe la clave a iOS y especifica tu Bundle ID

#### Para Backend:
1. Crea una credencial de tipo "API Key" sin restricciones (o restringe a tu servidor)
2. Habilita: Geocoding API, Places API

### 2. Configurar Variables de Entorno

#### Backend (`backend/.env`):
```env
GOOGLE_MAPS_API_KEY=your_backend_google_maps_api_key_here
```

#### Frontend (`app/.env`):
```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_ios_android_google_maps_api_key_here
```

---

## 📱 Cambios en el Frontend

### MapView Component
El componente `MapView.tsx` ahora usa `react-native-maps` con Google Maps SDK:

```typescript
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

<MapView
  provider={PROVIDER_GOOGLE}
  initialRegion={{...}}
>
  <Marker coordinate={{...}} />
  <Polyline coordinates={[...]} />
</MapView>
```

### Características Soportadas
- ✅ Marcadores de pickup/dropoff/driver
- ✅ Rutas con polilíneas
- ✅ Ubicación del usuario en tiempo real
- ✅ Pan, zoom, rotate
- ✅ Cálculo de bounds automático

### Características Removidas
- ❌ Modo offline (Google Maps no lo soporta nativamente)
- ❌ Estilos personalizados de Mapbox

---

## 🔌 Cambios en el Backend

### Google Maps Service
Nuevo archivo: `backend/src/services/googleMapsService.ts`

Métodos disponibles:
- `geocodeAddress(address)` - Dirección → Coordenadas
- `reverseGeocode(lat, lng)` - Coordenadas → Dirección
- `validateLocation(lat, lng)` - Validar ubicación
- `searchPlaces(query, lat?, lng?)` - Buscar lugares
- `getUsageStats()` - Estadísticas de uso

### Límites de Google Maps
- **Plan Gratuito**: 25,000 solicitudes/mes
- **Plan Pago**: $0.005-0.015 por solicitud
- **Costo estimado**: $0-150/mes según uso

### Integración con OSRM
Las rutas siguen siendo calculadas por OSRM (no cambia):
- Distancia y duración
- Polilíneas de rutas
- Matriz de distancias

---

## 🚀 Pasos de Implementación

### 1. Instalar Dependencias
```bash
cd app
npm install react-native-maps
```

### 2. Configurar API Keys
- Backend: Agregar `GOOGLE_MAPS_API_KEY` en `backend/.env`
- Frontend: Agregar `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` en `app/.env`

### 3. Compilar para Android
```bash
cd app
npm run android
```

### 4. Compilar para iOS
```bash
cd app
npm run ios
```

### 5. Probar Backend
```bash
cd backend
npm run dev
```

---

## 📊 Comparativa: Mapbox vs Google Maps

| Aspecto | Mapbox | Google Maps | Ganador |
|--------|--------|-------------|---------|
| **Costo** | $0-5/mes | $0-150/mes | Mapbox |
| **Precisión** | 98% | 99.5% | Google |
| **Geocodificación** | Buena | Excelente | Google |
| **Offline Maps** | Sí | No | Mapbox |
| **Personalización** | Excelente | Media | Mapbox |
| **Documentación** | Buena | Excelente | Google |
| **Comunidad** | Grande | Muy Grande | Google |

---

## ⚠️ Consideraciones Importantes

### Privacidad
- Google Maps envía datos de ubicación a servidores de Google
- Las rutas se procesan localmente en OSRM (privacidad garantizada)
- Considera usar OSRM autohospedado para máxima privacidad

### Rendimiento
- Google Maps es más rápido en geocodificación
- OSRM es más rápido en cálculo de rutas
- Combinación óptima para aplicaciones de taxis

### Escalabilidad
- Google Maps: Escalable pero con costos
- OSRM: Escalable sin costos adicionales (si es autohospedado)

---

## 🔄 Rollback a Mapbox

Si necesitas volver a Mapbox:

1. Revertir cambios en `mapsService.ts`
2. Restaurar `mapboxService.ts`
3. Actualizar `MapView.tsx` a usar Mapbox GL Native
4. Cambiar variables de entorno

---

## 📞 Soporte

Para problemas con:
- **Google Maps**: [Google Maps Documentation](https://developers.google.com/maps)
- **OSRM**: [OSRM Documentation](http://project-osrm.org/)
- **react-native-maps**: [GitHub Repository](https://github.com/react-native-maps/react-native-maps)

---

## ✨ Próximos Pasos

1. Obtener y configurar Google Maps API Keys
2. Probar en Android y iOS
3. Monitorear uso de API
4. Optimizar llamadas a API según necesidad
5. Considerar caché de resultados de geocodificación
