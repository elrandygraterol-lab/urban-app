# Instrucciones para Reconstruir la App con Google Maps API Key

## ⚠️ IMPORTANTE: Debes reconstruir la app

Los cambios en `app.json` (como agregar la Google Maps API key) requieren regenerar los archivos nativos y reconstruir la app.

## Opción 1: Rebuild Completo con EAS (Recomendado)

### Para Android:
```bash
cd app
eas build --platform android --profile development --clear-cache
```

### Para iOS:
```bash
cd app
eas build --platform ios --profile development --clear-cache
```

### Para ambos:
```bash
cd app
eas build --platform all --profile development --clear-cache
```

## Opción 2: Prebuild Local + Expo Dev Client

Si ya tienes un development build instalado y solo quieres probar localmente:

```bash
cd app

# Limpiar y regenerar archivos nativos
npx expo prebuild --clean

# Para Android
npx expo run:android

# Para iOS
npx expo run:ios
```

## Opción 3: Usar el Script de Limpieza

### Windows:
```powershell
cd app
powershell -ExecutionPolicy Bypass -File ./scripts/clean-and-build.ps1
```

### Linux/Mac:
```bash
cd app
bash ./scripts/clean-and-build.sh
```

## Verificar que la API Key se Aplicó

Después de reconstruir, verifica que la API key esté configurada:

### Android:
Revisa el archivo generado: `app/android/app/src/main/AndroidManifest.xml`

Debe contener:
```xml
<meta-data
  android:name="com.google.android.geo.API_KEY"
  android:value="AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU"/>
```

### iOS:
Revisa el archivo generado: `app/ios/apptaxis/Info.plist`

Debe contener:
```xml
<key>GMSApiKey</key>
<string>AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU</string>
```

## Próximos Pasos

Una vez reconstruida la app:

1. Instala el nuevo build en tu dispositivo
2. Inicia sesión como pasajero
3. Verifica que el mapa se cargue correctamente
4. Si ves errores, revisa los logs de Metro Bundler

## Notas

- El proceso de build puede tomar 10-20 minutos
- Asegúrate de tener conexión a internet estable
- Si usas EAS Build, necesitas estar autenticado: `eas login`
