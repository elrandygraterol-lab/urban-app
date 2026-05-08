# 🚀 Quick Start: Google Maps SDK + OSRM

## ⚡ Instalación Rápida (5 minutos)

### 1. Obtener Google Maps API Key

```bash
# Ir a Google Cloud Console
https://console.cloud.google.com/

# Crear proyecto → Habilitar APIs → Crear API Key
# Copiar la API Key
```

### 2. Configurar Backend

```bash
# Editar backend/.env
GOOGLE_MAPS_API_KEY=your_api_key_here
OSRM_URL=http://localhost:5000  # o https://router.project-osrm.org
```

### 3. Configurar Frontend

```bash
# Editar app/.env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### 4. Instalar Dependencias

```bash
# Frontend
cd app
npm install

# Backend
cd backend
npm install
```

### 5. Iniciar Servidores

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend (Android)
cd app
npm run android

# O Frontend (iOS)
cd app
npm run ios
```

---

## 📋 Verificación Rápida

### Backend
```bash
curl http://localhost:3000/api/maps/status
```

Respuesta esperada:
```json
{
  "googleMaps": {
    "status": "ok",
    "usage": {
      "requestsThisMonth": 0,
      "monthlyLimit": 25000,
      "remainingRequests": 25000,
      "percentageUsed": "0.00"
    }
  },
  "osrm": {
    "status": "ok",
    "mode": "public",
    "baseUrl": "https://router.project-osrm.org"
  }
}
```

### Frontend
- [ ] Mapa se carga correctamente
- [ ] Marcadores aparecen
- [ ] Rutas se muestran
- [ ] Ubicación del usuario funciona

---

## 🔑 Obtener API Keys (Detallado)

### Google Cloud Console

1. **Crear Proyecto**
   ```
   https://console.cloud.google.com/
   → Crear proyecto → Nombre: "UrbanTaxi"
   ```

2. **Habilitar APIs**
   ```
   Menú → APIs y servicios → Biblioteca
   → Buscar "Maps SDK for Android" → Habilitar
   → Buscar "Maps SDK for iOS" → Habilitar
   → Buscar "Geocoding API" → Habilitar
   → Buscar "Places API" → Habilitar
   ```

3. **Crear API Key**
   ```
   APIs y servicios → Credenciales → Crear credencial → API Key
   → Copiar API Key
   ```

4. **Restringir API Key (Opcional pero Recomendado)**
   ```
   Credenciales → Seleccionar API Key
   → Restricciones de aplicación → Android
   → Agregar SHA-1 fingerprint
   ```

---

## 🐛 Troubleshooting

### "Mapa no carga"
```bash
# Verificar API Key
echo $EXPO_PUBLIC_GOOGLE_MAPS_API_KEY

# Verificar que APIs están habilitadas
# https://console.cloud.google.com/apis/dashboard

# Verificar permisos en app.json
# Debe tener: ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION
```

### "Geocodificación no funciona"
```bash
# Verificar que Geocoding API está habilitada
# https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com

# Probar endpoint
curl "http://localhost:3000/api/maps/geocode" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"address":"1600 Amphitheatre Parkway, Mountain View, CA"}'
```

### "Rutas no se muestran"
```bash
# Verificar que OSRM está funcionando
curl "http://localhost:5000/route/v1/driving/13.388860,52.517037;13.385983,52.496891?overview=full"

# Si no funciona, usar OSRM público
# Editar backend/.env:
OSRM_URL=https://router.project-osrm.org
```

---

## 📊 Monitoreo

### Ver uso de API
```bash
# Backend
curl http://localhost:3000/api/maps/status | jq '.googleMaps.usage'
```

### Alertas en Google Cloud
```
https://console.cloud.google.com/
→ APIs y servicios → Cuotas
→ Configurar alertas
```

---

## 🔄 Cambiar de OSRM Público a Autohospedado

### Opción 1: OSRM Público (Recomendado para desarrollo)
```bash
# backend/.env
OSRM_URL=https://router.project-osrm.org
```

### Opción 2: OSRM Autohospedado (Recomendado para producción)
```bash
# Instalar Docker
docker pull osrm/osrm-backend

# Descargar datos
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/venezuela-latest.osm.pbf

# Iniciar servidor
docker run -t -i -p 5000:5000 -v "${PWD}:/data" osrm/osrm-backend osrm-routed --algorithm mld /data/venezuela-latest.osrm

# backend/.env
OSRM_URL=http://localhost:5000
```

---

## 📱 Compilar para Producción

### Android
```bash
cd app
npm run android -- --release
# O con EAS Build
eas build --platform android --release
```

### iOS
```bash
cd app
npm run ios -- --release
# O con EAS Build
eas build --platform ios --release
```

---

## 💡 Tips

1. **Caché de Geocodificación**
   - Implementar Redis para caché de resultados
   - Reducir llamadas a API

2. **Batch Requests**
   - Agrupar múltiples geocodificaciones
   - Usar matriz de distancias en lugar de múltiples requests

3. **Monitoreo**
   - Configurar alertas de cuota
   - Monitorear costos diarios
   - Revisar logs de errores

4. **Seguridad**
   - Nunca commitear API Keys
   - Usar variables de entorno
   - Restringir API Keys por aplicación

---

## 📞 Recursos

- [Google Maps Documentation](https://developers.google.com/maps)
- [react-native-maps](https://github.com/react-native-maps/react-native-maps)
- [OSRM Documentation](http://project-osrm.org/)
- [Expo Documentation](https://docs.expo.dev/)

---

## ✅ Checklist Final

- [ ] API Key obtenida
- [ ] Variables de entorno configuradas
- [ ] Backend iniciado
- [ ] Frontend compilado
- [ ] Mapa se carga
- [ ] Geocodificación funciona
- [ ] Rutas se muestran
- [ ] Ubicación del usuario funciona

¡Listo! 🎉
