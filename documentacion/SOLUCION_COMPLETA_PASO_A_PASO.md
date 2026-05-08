# ✅ SOLUCIÓN COMPLETA - Paso a Paso

**Fecha**: 21 de Marzo, 2026  
**Problema**: App crashea con error de Google Maps API Key  
**Causa**: Build viejo + OSRM no corriendo

---

## 🎯 RESUMEN DE CAMBIOS REALIZADOS

### ✅ Archivos Limpiados

1. **`backend/src/services/googleMapsService.ts`** - ❌ ELIMINADO
   - Servicio legacy de Google Maps que ya no se usaba

2. **`backend/src/config/index.ts`** - ✅ LIMPIADO
   - Removidas referencias a `googleMapsApiKey`
   - Removido objeto `googleMaps`

3. **`backend/.env`** - ✅ ACTUALIZADO
   - CORS_ORIGIN con nueva IP: `192.168.1.9`

4. **`backend/docker-compose.yml`** - ✅ ACTUALIZADO
   - CORS_ORIGIN con nueva IP: `192.168.1.9`

### ✅ Scripts Nuevos Creados

1. **`backend/start-osrm.ps1`** - Script para iniciar OSRM
2. **`backend/stop-osrm.ps1`** - Script para detener OSRM
3. **`backend/check-osrm.ps1`** - Script para verificar estado de OSRM
4. **`backend/package.json`** - Scripts npm actualizados

### ✅ Documentación Creada

1. **`DIAGNOSTICO_GOOGLE_MAPS_OSRM.md`** - Análisis completo del problema
2. **`SOLUCION_COMPLETA_PASO_A_PASO.md`** - Esta guía

---

## 📋 PASOS A SEGUIR (EN ORDEN)

### PASO 1: Verificar Estado de OSRM ⏱️ 1 minuto

```powershell
cd backend
npm run osrm:status
```

**Resultado esperado**:
- ✅ Si OSRM está corriendo: Continúa al PASO 3
- ❌ Si OSRM NO está corriendo: Continúa al PASO 2

---

### PASO 2: Iniciar OSRM ⏱️ 2-3 minutos

#### Opción A: Si OSRM ya está instalado

```powershell
cd backend
npm run osrm:start
```

**Verificar que funciona**:
```powershell
curl http://localhost:5000/status
```

Debe responder:
```json
{"status":"Ok"}
```

#### Opción B: Si OSRM NO está instalado

```powershell
cd backend
npm run osrm:setup
```

Este script:
1. Instala OSRM en WSL2
2. Descarga datos de Venezuela (~107MB)
3. Procesa los datos (5-10 minutos)
4. Inicia el servicio

**Tiempo total**: 15-20 minutos (solo la primera vez)

---

### PASO 3: Reiniciar Backend ⏱️ 30 segundos

```powershell
cd backend
docker-compose restart backend
```

**Verificar logs**:
```powershell
docker-compose logs -f backend
```

Buscar estas líneas:
```
✅ OSRM Service inicializado
✅ Server running on http://0.0.0.0:3000
```

Si ves errores de conexión a OSRM, regresa al PASO 2.

---

### PASO 4: Compilar Nueva Build ⏱️ 10-15 minutos

```powershell
cd app
npm run build:android
```

**Proceso**:
1. EAS Build se conecta a los servidores de Expo
2. Compila el APK con el código actual (sin Google Maps)
3. Genera un nuevo Build ID
4. Proporciona link de descarga

**Resultado esperado**:
```
✅ Build complete!
📦 Build ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
🔗 Download: https://expo.dev/accounts/randygraterol07/projects/app-taxis/builds/...
```

---

### PASO 5: Instalar y Probar ⏱️ 2-3 minutos

1. **Descargar APK**
   - Abre el link de descarga en tu dispositivo
   - O escanea el QR code

2. **Instalar APK**
   - Android te pedirá permisos para instalar
   - Acepta e instala

3. **Abrir App**
   - Abre UrbanTaxi
   - Debería abrir sin crash

4. **Verificar Funcionalidad**
   - ✅ App abre correctamente
   - ✅ No hay error de Google Maps API Key
   - ✅ Mapa se muestra
   - ✅ WebSocket conectado

---

## 🔍 VERIFICACIÓN COMPLETA

### Backend

```powershell
# 1. Verificar OSRM
cd backend
npm run osrm:status

# 2. Verificar backend
docker-compose ps

# 3. Verificar logs
docker-compose logs backend --tail 50
```

**Checklist**:
- [ ] OSRM corriendo en puerto 5000
- [ ] Backend corriendo en puerto 3000
- [ ] Sin errores en logs
- [ ] WebSocket activo

### App Móvil

**Checklist**:
- [ ] Nueva build instalada
- [ ] App abre sin crash
- [ ] Mapa se muestra correctamente
- [ ] Ubicación actual detectada
- [ ] WebSocket conectado (ver logs en app)

---

## 🚨 TROUBLESHOOTING

### Problema: OSRM no inicia

**Síntomas**:
```
❌ OSRM no está instalado en WSL2
```

**Solución**:
```powershell
cd backend
npm run osrm:setup
```

---

### Problema: Puerto 5000 ocupado

**Síntomas**:
```
Error: Address already in use
```

**Solución**:
```powershell
# Ver qué está usando el puerto
netstat -ano | findstr :5000

# Detener el proceso
taskkill /PID <PID> /F

# Reiniciar OSRM
cd backend
npm run osrm:start
```

---

### Problema: Backend no puede conectarse a OSRM

**Síntomas**:
```
Error: connect ECONNREFUSED 127.0.0.1:5000
```

**Solución**:
```powershell
# 1. Verificar que OSRM está corriendo
cd backend
npm run osrm:status

# 2. Probar endpoint manualmente
curl http://localhost:5000/status

# 3. Si no responde, reiniciar OSRM
npm run osrm:stop
npm run osrm:start
```

---

### Problema: Build falla

**Síntomas**:
```
Error: Build failed
```

**Solución**:
```powershell
# 1. Verificar que estás logueado en EAS
cd app
npx eas whoami

# 2. Si no estás logueado
npx eas login

# 3. Intentar build nuevamente
npm run build:android
```

---

### Problema: App sigue crasheando después de instalar nueva build

**Síntomas**:
- App crashea con error de Google Maps

**Solución**:
1. **Verificar que instalaste la build NUEVA**
   - Ve a Configuración > Apps > UrbanTaxi
   - Verifica la versión

2. **Desinstalar completamente la app vieja**
   ```
   Configuración > Apps > UrbanTaxi > Desinstalar
   ```

3. **Instalar build nueva desde cero**
   - Descarga el APK nuevamente
   - Instala

4. **Limpiar caché del dispositivo**
   - Reinicia el dispositivo
   - Instala la app

---

## 📊 STACK TECNOLÓGICO ACTUAL

### Backend
- **Framework**: Express.js + TypeScript
- **Base de datos**: PostgreSQL 15 + PostGIS
- **Caché**: Redis 7
- **WebSocket**: Socket.io
- **Routing**: OSRM (autohospedado en WSL2)
- **Geocoding**: Nominatim (OpenStreetMap)

### App Móvil
- **Framework**: React Native + Expo
- **Navegación**: Expo Router
- **Mapas**: react-native-maps (OpenStreetMap)
- **Estado**: Zustand
- **HTTP**: Axios
- **WebSocket**: Socket.io-client

### Servicios de Mapas (100% Open Source)
- **Visualización**: OpenStreetMap
- **Geocoding**: Nominatim
- **Routing**: OSRM
- **Costo**: $0/mes
- **Límites**: Ninguno
- **Precisión**: 97-99%

---

## 🎯 COMANDOS ÚTILES

### OSRM
```powershell
# Iniciar
cd backend
npm run osrm:start

# Detener
npm run osrm:stop

# Estado
npm run osrm:status

# Ver logs
wsl bash -c "tail -f ~/osrm-data/osrm.log"
```

### Backend
```powershell
# Iniciar servicios
cd backend
docker-compose up -d

# Ver logs
docker-compose logs -f backend

# Reiniciar backend
docker-compose restart backend

# Detener todo
docker-compose down
```

### App
```powershell
# Compilar Android
cd app
npm run build:android

# Compilar iOS
npm run build:ios

# Ver builds
npx eas build:list
```

---

## ✅ CHECKLIST FINAL

### Antes de compilar
- [ ] OSRM corriendo
- [ ] Backend corriendo sin errores
- [ ] CORS configurado con IP correcta
- [ ] WebSocket funcionando

### Después de compilar
- [ ] Build completado exitosamente
- [ ] APK descargado
- [ ] App vieja desinstalada
- [ ] Nueva build instalada
- [ ] App abre sin crash
- [ ] Todas las funcionalidades probadas

---

## 📚 DOCUMENTACIÓN RELACIONADA

- `DIAGNOSTICO_GOOGLE_MAPS_OSRM.md` - Análisis detallado del problema
- `backend/OSRM_README.md` - Guía completa de OSRM
- `backend/OSRM_ALMALINUX_SETUP.md` - Setup para producción
- `CAMBIOS_OPENSTREETMAP.md` - Cambios realizados anteriormente
- `app/EAS_BUILD_GUIDE.md` - Guía de compilación con EAS

---

## 🎉 RESULTADO ESPERADO

Después de seguir todos los pasos:

1. ✅ OSRM corriendo en WSL2 (puerto 5000)
2. ✅ Backend conectado a OSRM
3. ✅ Sin referencias a Google Maps en el código
4. ✅ Nueva build compilada e instalada
5. ✅ App funciona correctamente
6. ✅ Mapas se muestran con OpenStreetMap
7. ✅ Routing funciona con OSRM
8. ✅ WebSocket conectado
9. ✅ 100% Open Source Stack
10. ✅ $0/mes en costos de mapas

---

## 💡 NOTAS IMPORTANTES

1. **OSRM debe estar corriendo ANTES de iniciar el backend**
2. **La nueva build es OBLIGATORIA** - el APK viejo tiene Google Maps compilado
3. **OSRM solo necesita instalarse UNA VEZ** - después solo iniciar/detener
4. **Los datos de Venezuela se procesan UNA VEZ** - después se reutilizan
5. **OSRM usa ~500MB-1GB de RAM** - asegúrate de tener suficiente memoria

---

## 🚀 PRÓXIMOS PASOS

Una vez que todo funcione:

1. **Configurar inicio automático de OSRM** (opcional)
2. **Monitorear rendimiento** de OSRM
3. **Actualizar datos de mapas** mensualmente (opcional)
4. **Configurar backup** de datos de OSRM
5. **Documentar proceso** para producción

---

**¿Necesitas ayuda?** Revisa la sección de Troubleshooting o consulta la documentación relacionada.
