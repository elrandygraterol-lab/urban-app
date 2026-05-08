# 🔍 DIAGNÓSTICO COMPLETO: Google Maps y OSRM

**Fecha**: 21 de Marzo, 2026  
**Estado**: ❌ Problemas encontrados

---

## 📊 RESUMEN EJECUTIVO

### ❌ Problemas Críticos

1. **OSRM no está corriendo** - El servicio de routing no está activo
2. **Build viejo instalado** - APK tiene referencias a Google Maps compiladas
3. **Archivos legacy de Google Maps** - Código antiguo todavía presente

### ✅ Lo que está bien

1. **Backend funcional** - Servidor corriendo correctamente en puerto 3000
2. **CORS actualizado** - Nueva IP (192.168.1.9) configurada
3. **Código principal limpio** - mapsService.ts usa 100% OpenStreetMap + OSRM
4. **app.json limpio** - Sin configuración de Google Maps

---

## 🔍 ANÁLISIS DETALLADO

### 1. OSRM (Open Source Routing Machine)

**Estado**: ❌ NO CORRIENDO

```bash
# Verificación realizada:
$ wsl bash -c "ps aux | grep osrm"
# Resultado: No hay proceso osrm-routed activo

$ curl http://localhost:5000/status
# Resultado: Connection refused
```

**Impacto**:
- La app no podrá calcular rutas
- Estimaciones de distancia/tiempo fallarán
- Búsqueda de conductores cercanos no funcionará

**Configuración actual**:
```env
# backend/.env
OSRM_URL=http://localhost:5000

# backend/docker-compose.yml
OSRM_URL: http://host.docker.internal:5000
```

---

### 2. Referencias a Google Maps

**Estado**: ⚠️ ARCHIVOS LEGACY PRESENTES

#### Archivos que todavía existen:

1. **`backend/src/services/googleMapsService.ts`**
   - ❌ Servicio completo de Google Maps
   - ⚠️ NO se está usando activamente
   - ✅ Puede eliminarse sin problemas

2. **`backend/src/config/index.ts`**
   - ⚠️ Tiene configuración de `googleMapsApiKey`
   - ⚠️ Comentado como "Ya no se usa"
   - ✅ Puede eliminarse

#### Archivos que SÍ están limpios:

1. **`backend/src/services/mapsService.ts`** ✅
   - Usa 100% OpenStreetMap + Nominatim + OSRM
   - Sin referencias a Google Maps
   - Arquitectura correcta

2. **`app/app.json`** ✅
   - Sin configuración de Google Maps API Key
   - Plugin `react-native-maps` sin configuración (usa mapa nativo)

3. **Variables de entorno** ✅
   - `app/.env`: Sin GOOGLE_MAPS_API_KEY
   - `backend/.env`: Sin GOOGLE_MAPS_API_KEY

---

### 3. Crash de la App

**Error reportado**:
```
java.lang.IllegalStateException: API key not found. 
Check that <meta-data android:name="com.google.android.geo.API_KEY"/>
```

**Causa raíz**:
- El APK instalado fue compilado ANTES de remover Google Maps
- El código compilado tiene referencias a Google Maps en el AndroidManifest.xml
- Aunque el código fuente está limpio, el binario no

**Solución**:
- Compilar nueva build con el código actual
- Instalar nuevo APK

---

## 🛠️ PLAN DE SOLUCIÓN

### PASO 1: Iniciar OSRM en WSL2

```bash
# Opción A: Si ya tienes OSRM instalado
wsl bash -c "cd ~/osrm-data && osrm-routed --algorithm mld venezuela-latest.osrm --port 5000 --ip 0.0.0.0 &"

# Opción B: Si NO tienes OSRM instalado
cd backend
npm run osrm:setup
```

**Verificar que funciona**:
```bash
curl http://localhost:5000/status
# Debe responder: {"status":"Ok"}
```

---

### PASO 2: Limpiar archivos legacy de Google Maps

Eliminar archivos que ya no se usan:

1. **`backend/src/services/googleMapsService.ts`**
2. Limpiar referencias en **`backend/src/config/index.ts`**

---

### PASO 3: Reiniciar backend

```bash
cd backend
docker-compose restart backend
```

**Verificar logs**:
```bash
docker-compose logs -f backend
```

Buscar:
- ✅ "OSRM Service inicializado"
- ✅ "Server running on http://0.0.0.0:3000"
- ❌ Errores de conexión a OSRM

---

### PASO 4: Compilar nueva build de la app

```bash
cd app
npm run build:android
```

**Tiempo estimado**: 10-15 minutos

**Resultado esperado**:
- Build ID nuevo
- APK sin referencias a Google Maps
- Listo para instalar

---

### PASO 5: Instalar y probar

1. Descargar APK desde EAS
2. Instalar en dispositivo
3. Abrir app
4. Verificar que NO hay error de Google Maps API Key
5. Verificar que el mapa se muestra correctamente

---

## 📋 CHECKLIST DE VERIFICACIÓN

### Backend
- [ ] OSRM corriendo en puerto 5000
- [ ] Backend puede conectarse a OSRM
- [ ] Archivos legacy de Google Maps eliminados
- [ ] Backend reiniciado sin errores

### App Móvil
- [ ] Nueva build compilada
- [ ] APK instalado en dispositivo
- [ ] App abre sin crash
- [ ] Mapa se muestra correctamente
- [ ] WebSocket conectado

### Funcionalidad
- [ ] Registro de usuario funciona
- [ ] Login funciona
- [ ] Mapa muestra ubicación actual
- [ ] Búsqueda de direcciones funciona
- [ ] Cálculo de rutas funciona

---

## 🎯 STACK ACTUAL (100% Open Source)

### Mapas y Routing
- **Visualización**: OpenStreetMap (via react-native-maps)
- **Geocodificación**: Nominatim (OpenStreetMap)
- **Routing**: OSRM (autohospedado en WSL2)

### Ventajas
- ✅ 100% Gratuito ($0/mes)
- ✅ Sin límites de uso
- ✅ Privacidad total (datos locales)
- ✅ Control total
- ✅ Código abierto
- ✅ 97-99% precisión (excelente para taxis)

### Comparación con Google Maps
| Aspecto | Google Maps | OpenStreetMap + OSRM |
|---------|-------------|----------------------|
| Costo | $200/mes gratis, luego $7/1000 | $0/mes |
| Límites | Sí (después de $200) | No |
| API Key | Requerida | No necesaria |
| Privacidad | Datos enviados a Google | Datos locales |
| Precisión | 99.5% | 97-99% |
| Offline | No | Sí (con configuración) |

---

## 📚 DOCUMENTACIÓN RELACIONADA

- `backend/OSRM_README.md` - Guía completa de OSRM
- `backend/OSRM_ALMALINUX_SETUP.md` - Setup para producción
- `CAMBIOS_OPENSTREETMAP.md` - Cambios realizados
- `app/EAS_BUILD_GUIDE.md` - Guía de compilación

---

## 🚨 NOTAS IMPORTANTES

1. **OSRM debe estar corriendo ANTES de iniciar el backend**
2. **El puerto 5000 debe estar libre** (no usado por otro servicio)
3. **WSL2 debe estar instalado** (en Windows)
4. **La nueva build es OBLIGATORIA** - el APK viejo tiene Google Maps compilado

---

## ✅ PRÓXIMOS PASOS

1. Iniciar OSRM
2. Limpiar archivos legacy
3. Reiniciar backend
4. Compilar nueva build
5. Instalar y probar

**Tiempo total estimado**: 20-30 minutos
