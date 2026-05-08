# 🔄 Compilar App Desde Cero - Limpieza Total

## 📋 Qué se va a limpiar

Este proceso eliminará:
- ✅ `node_modules/` - Todas las dependencias instaladas
- ✅ `.expo/` - Cache de Expo
- ✅ `package-lock.json` - Lock file de npm
- ✅ Cache de npm
- ✅ Cache de EAS Build
- ✅ Watchman (si está instalado)

## 🚀 Comandos a Ejecutar

### Opción 1: Script Automático (RECOMENDADO)

```bash
cd app
npm run clean:full
```

### Opción 2: Comandos Manuales (Paso a Paso)

```bash
# 1. Ir al directorio de la app
cd app

# 2. Limpiar cache de Watchman (si está instalado)
watchman watch-del-all 2>/dev/null || echo "Watchman no instalado, continuando..."

# 3. Eliminar node_modules
rm -rf node_modules

# 4. Eliminar .expo
rm -rf .expo

# 5. Eliminar package-lock.json
rm -f package-lock.json

# 6. Limpiar cache de npm
npm cache clean --force

# 7. Reinstalar dependencias desde cero
npm install --legacy-peer-deps

# 8. Compilar APK con cache limpio
npm run build:dev:android
```

## ⏱️ Tiempo Estimado

- Limpieza: ~30 segundos
- Instalación de dependencias: ~2-3 minutos
- Compilación en EAS: ~15-20 minutos

**Total: ~20-25 minutos**

## 📝 Notas Importantes

1. **Internet requerido**: Se descargarán ~500MB de dependencias
2. **Espacio en disco**: Se necesitan ~2GB libres
3. **No interrumpir**: Deja que el proceso termine completamente

## ✅ Verificación Post-Compilación

Después de que termine la compilación:

1. Descarga la nueva APK del link que aparecerá
2. Desinstala la APK anterior de tu dispositivo
3. Instala la nueva APK
4. Ejecuta `npm run start:dev`
5. Escanea el QR con la nueva APK

## 🆘 Si Algo Sale Mal

Si encuentras errores durante la instalación:

```bash
# Limpiar TODO de nuevo
rm -rf node_modules .expo package-lock.json
npm cache clean --force

# Reinstalar
npm install --legacy-peer-deps --verbose
```

Si el build falla en EAS:
- Revisa los logs en el link que proporciona EAS
- Copia el error y pégalo en el chat

## 🎯 Resultado Esperado

Al final deberías ver:

```
✓ Build finished

🤖 Open this link on your Android devices (or scan the QR code) to install the app:
https://expo.dev/accounts/randygraterol07/projects/app-taxis/builds/[BUILD_ID]
```

---

**¿Listo para empezar?** Ejecuta:

```bash
cd app && npm run clean:full
```
