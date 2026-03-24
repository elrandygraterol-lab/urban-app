# Google Maps API Key Setup

## ¿Por qué necesitamos Google Maps API Key?

Aunque este proyecto usa **OpenStreetMap + Nominatim + OSRM** para todos los datos del mapa (tiles, geocoding, routing), `react-native-maps` en Android **requiere Google Maps SDK** como motor de renderizado nativo.

**Importante**: La API key es SOLO para el SDK de renderizado. Todos los datos del mapa siguen viniendo de OpenStreetMap/OSRM/Nominatim.

## Configuración Actual

### API Key Configurada
- **Android**: `AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU`
- **iOS**: `AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU`

### Ubicaciones de la API Key

1. **app.json** (Configuración de Expo)
   ```json
   {
     "expo": {
       "android": {
         "config": {
           "googleMaps": {
             "apiKey": "AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU"
           }
         }
       },
       "ios": {
         "config": {
           "googleMapsApiKey": "AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU"
         }
       }
     }
   }
   ```

2. **.env** (Variables de entorno)
   ```
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU
   ```

## Restricciones de Seguridad Configuradas

### Restricciones de Aplicación
- **Tipo**: Aplicaciones de Android
- **Nombre del paquete**: `com.urbantaxi.passenger`
- **Huella digital SHA-1**: Se configurará después del primer build

### Restricciones de API
- ✅ Maps SDK for Android
- ✅ Maps SDK for iOS

## Límites Gratuitos de Google Maps

- **Cargas de mapa dinámico**: 28,000 cargas/mes gratis
- **Cargas de mapa estático**: 28,000 cargas/mes gratis

**Nota**: Como solo usamos el SDK para renderizado (no para geocoding, routing, etc.), el consumo será mínimo.

## Stack de Mapas Completo

| Componente | Proveedor | Costo |
|------------|-----------|-------|
| Motor de renderizado | Google Maps SDK | Gratis (hasta 28k/mes) |
| Tiles del mapa | OpenStreetMap | Gratis |
| Geocoding | Nominatim | Gratis |
| Routing | OSRM | Gratis |

## Cómo Obtener una Nueva API Key

Si necesitas crear una nueva API key:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto o crea uno nuevo
3. Ve a **APIs y servicios** → **Biblioteca**
4. Habilita:
   - Maps SDK for Android
   - Maps SDK for iOS (si usas iOS)
5. Ve a **APIs y servicios** → **Credenciales**
6. Haz clic en **+ CREAR CREDENCIALES** → **Clave de API**
7. Copia la API key generada
8. Haz clic en **RESTRINGIR CLAVE**
9. Configura:
   - **Restricciones de aplicación**: Aplicaciones de Android
   - **Nombre del paquete**: `com.urbantaxi.passenger`
   - **Restricciones de API**: Solo Maps SDK for Android e iOS
10. Guarda los cambios

## Actualizar la API Key

Si necesitas cambiar la API key:

1. Actualiza en `app/app.json`:
   - `expo.android.config.googleMaps.apiKey`
   - `expo.ios.config.googleMapsApiKey`
2. Actualiza en `app/.env`:
   - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
3. Ejecuta `npx expo prebuild --clean` para regenerar archivos nativos
4. Reconstruye la app con EAS Build

## Troubleshooting

### Error: "API key not found"
- Verifica que la API key esté en `app.json`
- Ejecuta `npx expo prebuild --clean`
- Reconstruye la app

### Error: "This API key is not authorized"
- Verifica las restricciones de la API key en Google Cloud Console
- Asegúrate de que el nombre del paquete coincida: `com.urbantaxi.passenger`
- Verifica que Maps SDK for Android esté habilitado

### Mapa no se muestra
- Verifica que la API key sea válida
- Revisa los logs de Metro Bundler para errores
- Verifica que los permisos de ubicación estén otorgados
