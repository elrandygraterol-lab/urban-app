# 🔧 Solución a Errores de Build en EAS

## Problema
Los builds en EAS están fallando en diferentes fases (Prebuild, Gradle, Install dependencies).

## Cambios Realizados

### 1. Actualización de `eas.json`
- ✅ Agregado `EXPO_NO_DOTENV=1` para evitar conflictos con variables de entorno
- ✅ Deshabilitado cache con `"cache": { "disabled": true }`
- ✅ Agregado `--clear-cache` a los scripts de build

### 2. Creación de `.easignore`
- ✅ Excluye archivos innecesarios del build (documentación, tests, cache)

### 3. Simplificación de `app.json`
- ✅ Removido `icon` del plugin de notificaciones (puede causar conflictos)

### 4. Scripts actualizados
- ✅ Agregado `--clear-cache` a comandos de build
- ✅ Agregado script `prebuild` para limpiar proyecto localmente

## 🚀 Pasos para Intentar de Nuevo

### Opción 1: Build con Cache Limpio (RECOMENDADO)
```bash
cd app
npm run build:dev:android
```

Este comando ahora incluye `--clear-cache` automáticamente.

### Opción 2: Limpiar Localmente Primero
Si la Opción 1 falla, intenta limpiar tu proyecto local primero:

```bash
cd app

# Limpiar cache local
rm -rf node_modules
rm -rf .expo
rm package-lock.json

# Reinstalar dependencias
npm install --legacy-peer-deps

# Intentar build
npm run build:dev:android
```

### Opción 3: Prebuild Local (Diagnóstico)
Para ver si hay errores en el prebuild localmente:

```bash
cd app
npm run prebuild
```

Esto ejecutará `expo prebuild --clean` y te mostrará cualquier error antes de subirlo a EAS.

## 📋 Verificación de Logs

Cuando el build falle, revisa los logs en:
https://expo.dev/accounts/randygraterol07/projects/app-taxis/builds

Busca específicamente:
- **Prebuild phase**: Errores de configuración o plugins
- **Install dependencies**: Conflictos de dependencias
- **Run gradlew**: Errores de compilación de Android

## 🔍 Posibles Causas Comunes

1. **Conflictos de dependencias**: Ya solucionado con `legacy-peer-deps=true`
2. **Cache corrupto**: Solucionado con `--clear-cache`
3. **Archivos innecesarios**: Solucionado con `.easignore`
4. **Variables de entorno**: Solucionado con `EXPO_NO_DOTENV=1`

## 📞 Si Sigue Fallando

Si después de estos cambios el build sigue fallando:

1. Copia el **Build ID** del error
2. Abre los logs en: `https://expo.dev/accounts/randygraterol07/projects/app-taxis/builds/[BUILD_ID]`
3. Busca la fase que falló (Prebuild, Install, Gradle)
4. Copia el mensaje de error específico
5. Compártelo para análisis más detallado

## ⏱️ Tiempo Estimado
- Build en cola (Free tier): 5-15 minutos
- Build execution: 10-15 minutos
- **Total**: 15-30 minutos

## ✅ Próximos Pasos Después del Build Exitoso

1. Descargar el APK desde EAS
2. Instalar en tu teléfono Android
3. Verificar que los mapas funcionen
4. Verificar que las notificaciones funcionen
5. Probar desarrollo en tiempo real con `npm start` y escanear QR
