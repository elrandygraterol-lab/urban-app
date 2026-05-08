# ✅ Checklist de Configuración: Google Maps SDK + OSRM

## 🎯 Objetivo
Completar la migración de Mapbox a Google Maps SDK (Android e iOS) + OSRM

---

## 📋 Fase 1: Obtener Google Maps API Keys

### Google Cloud Console Setup
- [ ] Ir a [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Crear nuevo proyecto o seleccionar existente
- [ ] Habilitar facturación (requerido para APIs)
- [ ] Crear 3 API Keys (Backend, Android, iOS)

### Backend API Key
- [ ] Crear API Key sin restricciones
- [ ] Habilitar APIs:
  - [ ] Maps SDK for Android
  - [ ] Maps SDK for iOS
  - [ ] Geocoding API
  - [ ] Places API
- [ ] Copiar API Key
- [ ] Guardar en `backend/.env` como `GOOGLE_MAPS_API_KEY`

### Android API Key
- [ ] Crear API Key
- [ ] Restringir a Android
- [ ] Obtener SHA-1 fingerprint:
  ```bash
  cd app
  npm run android -- --get-fingerprint
  # O manualmente:
  keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
  ```
- [ ] Agregar SHA-1 fingerprint a la restricción
- [ ] Copiar API Key
- [ ] Guardar en `app/.env` como `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`

### iOS API Key
- [ ] Crear API Key
- [ ] Restringir a iOS
- [ ] Agregar Bundle ID: `com.urbantaxi.passenger`
- [ ] Copiar API Key
- [ ] Guardar en `app/.env` como `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`

---

## 🔧 Fase 2: Configuración del Backend

### Variables de Entorno
- [ ] Actualizar `backend/.env`:
  ```env
  GOOGLE_MAPS_API_KEY=your_key_here
  ```
- [ ] Verificar que `OSRM_URL` esté configurado
- [ ] Verificar que `OSRM_URL` apunte a servidor correcto

### Servicios
- [ ] Verificar que `googleMapsService.ts` existe
- [ ] Verificar que `mapsService.ts` importa `googleMapsService`
- [ ] Verificar que `config/index.ts` tiene `googleMapsApiKey`

### Testing
- [ ] Ejecutar tests del backend:
  ```bash
  cd backend
  npm test
  ```
- [ ] Verificar que no hay errores de importación

---

## 📱 Fase 3: Configuración del Frontend

### Variables de Entorno
- [ ] Actualizar `app/.env`:
  ```env
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
  ```
- [ ] Verificar que `EXPO_PUBLIC_API_URL` apunta al backend correcto

### Dependencias
- [ ] Verificar que `react-native-maps` está en `package.json`
- [ ] Ejecutar `npm install` si es necesario

### Configuración de Expo
- [ ] Verificar `app/app.json` tiene configuración de Google Maps
- [ ] Verificar permisos de ubicación en `app.json`:
  ```json
  "permissions": [
    "ACCESS_COARSE_LOCATION",
    "ACCESS_FINE_LOCATION"
  ]
  ```

### Testing
- [ ] Ejecutar tests del frontend:
  ```bash
  cd app
  npm test
  ```
- [ ] Verificar que no hay errores de importación

---

## 🚀 Fase 4: Compilación y Testing

### Android
- [ ] Compilar para Android:
  ```bash
  cd app
  npm run android
  ```
- [ ] Verificar que el mapa se carga correctamente
- [ ] Probar marcadores (pickup, dropoff, driver)
- [ ] Probar rutas (polilíneas)
- [ ] Probar ubicación del usuario

### iOS
- [ ] Compilar para iOS:
  ```bash
  cd app
  npm run ios
  ```
- [ ] Verificar que el mapa se carga correctamente
- [ ] Probar marcadores (pickup, dropoff, driver)
- [ ] Probar rutas (polilíneas)
- [ ] Probar ubicación del usuario

### Backend
- [ ] Iniciar servidor backend:
  ```bash
  cd backend
  npm run dev
  ```
- [ ] Probar endpoint `/api/maps/estimate`
- [ ] Probar endpoint `/api/maps/geocode`
- [ ] Probar endpoint `/api/maps/reverse-geocode`
- [ ] Probar endpoint `/api/maps/search-places`
- [ ] Probar endpoint `/api/maps/status`

---

## 📊 Fase 5: Monitoreo y Optimización

### Monitoreo de API
- [ ] Configurar alertas en Google Cloud Console
- [ ] Monitorear uso diario de API
- [ ] Verificar costos estimados
- [ ] Establecer límites de cuota si es necesario

### Optimización
- [ ] Implementar caché de geocodificación
- [ ] Implementar caché de búsqueda de lugares
- [ ] Reducir llamadas innecesarias a API
- [ ] Usar batch requests cuando sea posible

### Documentación
- [ ] Actualizar documentación del proyecto
- [ ] Documentar API Keys y restricciones
- [ ] Documentar límites de cuota
- [ ] Documentar procedimiento de rollback

---

## 🔄 Fase 6: Producción

### Pre-Deployment
- [ ] Crear API Keys de producción
- [ ] Configurar restricciones de producción
- [ ] Actualizar variables de entorno de producción
- [ ] Realizar testing en staging

### Deployment
- [ ] Desplegar backend con nuevas variables
- [ ] Compilar APK/IPA con nuevas variables
- [ ] Publicar en Play Store/App Store
- [ ] Monitorear errores en producción

### Post-Deployment
- [ ] Verificar que mapas funcionan en producción
- [ ] Monitorear uso de API
- [ ] Recopilar feedback de usuarios
- [ ] Estar listo para rollback si es necesario

---

## 🆘 Troubleshooting

### Mapa no carga
- [ ] Verificar que API Key es válida
- [ ] Verificar que APIs están habilitadas en Google Cloud
- [ ] Verificar que restricciones de API Key son correctas
- [ ] Verificar que permisos de ubicación están otorgados

### Geocodificación no funciona
- [ ] Verificar que Geocoding API está habilitada
- [ ] Verificar que API Key tiene acceso a Geocoding API
- [ ] Verificar que dirección es válida
- [ ] Verificar límite de cuota no ha sido alcanzado

### Búsqueda de lugares no funciona
- [ ] Verificar que Places API está habilitada
- [ ] Verificar que API Key tiene acceso a Places API
- [ ] Verificar que query es válido
- [ ] Verificar límite de cuota no ha sido alcanzado

### Rutas no se muestran
- [ ] Verificar que OSRM está funcionando
- [ ] Verificar que coordenadas son válidas
- [ ] Verificar que polilínea se está renderizando
- [ ] Verificar que no hay errores en consola

---

## 📞 Recursos Útiles

- [Google Maps Documentation](https://developers.google.com/maps)
- [Google Cloud Console](https://console.cloud.google.com/)
- [react-native-maps GitHub](https://github.com/react-native-maps/react-native-maps)
- [OSRM Documentation](http://project-osrm.org/)
- [Expo Documentation](https://docs.expo.dev/)

---

## ✨ Notas Finales

- Asegúrate de tener credenciales de Google Cloud válidas
- Mantén las API Keys seguras (no las commits en Git)
- Monitorea el uso de API para evitar sorpresas de costos
- Considera usar OSRM autohospedado para máxima privacidad
- Realiza testing exhaustivo antes de producción
