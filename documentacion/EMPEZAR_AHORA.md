# 🚀 Empezar Ahora: Compilar tu Development Build

## ⚡ Inicio Rápido (Copia y Pega)

### Paso 1: Instalar EAS CLI (si no lo tienes)

```bash
npm install -g eas-cli
```

### Paso 2: Login en Expo

```bash
eas login
```

Si no tienes cuenta:
```bash
eas register
```

### Paso 3: Configurar EAS (primera vez)

```bash
cd app
eas build:configure
```

Responde:
- **"Would you like to automatically create an EAS project?"** → `Yes` (Enter)
- **"Generate a new Android Keystore?"** → `Yes` (Enter)

### Paso 4: Compilar Android Development Build

```bash
npm run build:dev:android
```

O directamente:
```bash
eas build --profile development --platform android
```

**Tiempo de espera**: 10-15 minutos ☕

### Paso 5: Descargar e Instalar

1. Cuando termine, EAS te dará un link
2. Descarga el APK
3. Transfiere a tu teléfono (USB, WhatsApp, Drive, etc.)
4. Instala el APK en tu teléfono
5. Permite instalación de fuentes desconocidas si te lo pide

### Paso 6: Iniciar Desarrollo

```bash
npm run start:dev
```

O directamente:
```bash
npx expo start --dev-client
```

### Paso 7: Conectar tu teléfono

1. Abre la app "app-taxis (dev)" en tu teléfono
2. Escanea el QR de tu terminal
3. ¡Listo! 🎉

---

## 📱 Desarrollo Diario (después de instalar)

Cada día solo necesitas:

```bash
cd app
npm run start:dev
```

Luego:
1. Abre la app en tu teléfono
2. Escanea el QR
3. Desarrolla con hot reload

---

## 🎯 Scripts Disponibles

### Desarrollo:
```bash
npm run start:dev              # Iniciar servidor para Development Build
npm run build:dev:android      # Compilar Android Development Build
npm run build:dev:ios          # Compilar iOS Development Build
npm run build:dev:all          # Compilar ambas plataformas
```

### Preview (testing sin hot reload):
```bash
npm run build:preview:android  # Compilar Android Preview
npm run build:preview:ios      # Compilar iOS Preview
```

### Producción:
```bash
npm run build:prod:android     # Compilar Android Production
npm run build:prod:ios         # Compilar iOS Production
```

---

## ⚠️ Importante: Google Maps API Key

Antes de compilar, asegúrate de tener tu Google Maps API Key configurada en `app.json`:

```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "TU_API_KEY_AQUI"
        }
      }
    },
    "ios": {
      "config": {
        "googleMapsApiKey": "TU_API_KEY_AQUI"
      }
    },
    "plugins": [
      [
        "react-native-maps",
        {
          "googleMapsApiKey": "TU_API_KEY_AQUI"
        }
      ]
    ]
  }
}
```

Si no tienes API Key:
1. Ve a: https://console.cloud.google.com/
2. Crea un proyecto
3. Habilita "Maps SDK for Android" y "Maps SDK for iOS"
4. Crea credenciales (API Key)
5. Copia la API Key a `app.json`

---

## 🐛 Solución de Problemas

### Error: "eas: command not found"
```bash
npm install -g eas-cli
```

### Error: "Not logged in"
```bash
eas login
```

### Error: "Build failed"
```bash
# Ver logs
eas build:view

# Limpiar caché y reintentar
eas build --profile development --platform android --clear-cache
```

### Error: "Cannot install APK"
- Ve a Configuración → Seguridad
- Habilita "Permitir instalación de fuentes desconocidas"

---

## 📊 Verificar Estado de Builds

```bash
# Ver lista de builds
eas build:list

# Ver detalles de un build específico
eas build:view [build-id]
```

O visita: https://expo.dev

---

## ✅ Checklist

Antes de compilar:

- [ ] Node.js instalado
- [ ] EAS CLI instalado (`npm install -g eas-cli`)
- [ ] Cuenta de Expo creada
- [ ] Login en EAS (`eas login`)
- [ ] Google Maps API Key configurada en `app.json`
- [ ] Teléfono Android listo para testing

---

## 🎉 ¡Listo!

Después de seguir estos pasos tendrás:
- ✅ App con mapas funcionando
- ✅ Notificaciones push funcionando
- ✅ Hot reload para desarrollo rápido
- ✅ La misma app que subirás a producción

---

## 📞 Ayuda

Si tienes problemas:
1. Lee `EAS_BUILD_GUIDE.md` para más detalles
2. Visita: https://docs.expo.dev/build/introduction/
3. Discord de Expo: https://chat.expo.dev/

---

## 🚀 Comando Único (Todo en Uno)

Si ya tienes EAS CLI instalado y configurado:

```bash
cd app && npm run build:dev:android
```

¡Eso es todo! Espera 15 minutos y tendrás tu APK listo. 🎉
