# 🔴 Problema: API Key No Se Aplicó en el Build

## Diagnóstico

El error sigue apareciendo:
```
java.lang.IllegalStateException: API key not found. Check that <meta-data android:name="com.google.android.geo.API_KEY" android:value="your API key"/> is in the <application> element of AndroidManifest.xml
```

**Causa**: Aunque agregamos la API key en `app.json`, NO se inyectó en el `AndroidManifest.xml` durante el build.

## ¿Por Qué Pasó Esto?

Cuando usas EAS Build, el proceso es:

1. EAS Build clona tu código
2. Ejecuta `expo prebuild` para generar archivos nativos (Android/iOS)
3. Compila la app nativa

**El problema**: Si `expo prebuild` no se ejecuta correctamente o usa una versión cacheada de los archivos nativos, la API key NO se inyecta.

## Soluciones

### Solución 1: Forzar Prebuild Limpio (RECOMENDADO)

Agrega esto a tu `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "prebuildCommand": "npx expo prebuild --clean",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      }
    }
  }
}
```

Luego rebuild:
```bash
cd app
eas build --platform android --profile development --clear-cache
```

### Solución 2: Verificar Manualmente el AndroidManifest.xml

Después del build, descarga el APK y descompílelo para verificar:

```bash
# Descomprimir APK
unzip app-debug.apk -d apk-contents

# Ver AndroidManifest.xml
cat apk-contents/AndroidManifest.xml | grep "API_KEY"
```

Deberías ver:
```xml
<meta-data
  android:name="com.google.android.geo.API_KEY"
  android:value="AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU"/>
```

### Solución 3: Build Local para Verificar

Si quieres verificar localmente antes de usar EAS:

```bash
cd app

# Limpiar todo
rm -rf android ios

# Generar archivos nativos
npx expo prebuild --clean

# Verificar que la API key esté en AndroidManifest.xml
cat android/app/src/main/AndroidManifest.xml | grep "API_KEY"

# Si está ahí, hacer build local
npx expo run:android
```

## Logging Mejorado

He agregado logging extensivo para que TODOS los errores aparezcan en Metro Bundler:

1. **ErrorBoundary Global**: Captura todos los errores de React
2. **Error Logger**: Captura console.error, console.warn, y promesas rechazadas
3. **Logging en Componentes**: Logs detallados en cada paso crítico

### Cómo Ver los Logs

Ahora verás logs como:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 ERROR #1 [2024-03-21T12:43:00.000Z]
📍 Context: PassengerHomeScreen
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 Message: API key not found
📚 Stack Trace:
  at MapView.onCreate(MapView.java:394)
  ...
🏷️  Error Type: IllegalStateException
ℹ️  Additional Info: { context: 'MapView error' }
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Próximos Pasos

1. **Actualiza eas.json** con `prebuildCommand`
2. **Rebuild** con `--clear-cache`
3. **Verifica** que la API key esté en AndroidManifest.xml
4. **Prueba** la app
5. **Revisa logs** en Metro Bundler (ahora mucho más detallados)

## Verificación Post-Build

Después de instalar el nuevo build, verifica en Metro Bundler:

- ✅ Deberías ver: `ℹ️  INFO [timestamp] 📍 Context: PassengerHomeScreen - MapView ready`
- ❌ Si ves: `🔴 ERROR - API key not found` → El prebuild no funcionó

## Alternativa: Configuración Manual

Si EAS Build sigue sin aplicar la API key, puedes configurarla manualmente:

1. Genera archivos nativos localmente: `npx expo prebuild --clean`
2. Edita `android/app/src/main/AndroidManifest.xml` manualmente
3. Agrega dentro de `<application>`:
   ```xml
   <meta-data
     android:name="com.google.android.geo.API_KEY"
     android:value="AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU"/>
   ```
4. Commit los archivos nativos al repo
5. Rebuild con EAS

**Nota**: Esto NO es recomendado porque los archivos nativos deberían ser generados automáticamente.
