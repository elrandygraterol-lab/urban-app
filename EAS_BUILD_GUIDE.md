# Guía Completa: EAS Build para Development (Android e iOS)

## 🎯 ¿Qué es EAS Build?

EAS (Expo Application Services) Build compila tu app en la nube de Expo, sin necesitar configurar Android Studio o Xcode localmente.

**Ventajas**:
- ✅ No necesitas Mac para compilar iOS
- ✅ No necesitas configurar Android Studio
- ✅ Compila en servidores potentes (más rápido)
- ✅ Incluye todos los módulos nativos (mapas, notificaciones, etc.)

---

## 💰 Costos y Límites

### Plan Free (Gratuito)
- **30 builds/mes** (Android + iOS combinados)
- Suficiente para desarrollo
- Sin tarjeta de crédito requerida

### Plan Production ($29/mes)
- Builds ilimitados
- Solo necesario si haces muchos builds

**Recomendación**: Empieza con el plan Free. 30 builds/mes es más que suficiente para desarrollo.

---

## 📱 ¿Qué obtendrás?

Después de compilar, tendrás:

### Android
- Archivo `.apk` o `.aab` que puedes instalar directamente en tu teléfono
- Funciona como una app normal (no necesitas Expo Go)
- **Mapas y notificaciones funcionando al 100%**

### iOS
- Archivo `.ipa` que puedes instalar vía TestFlight o directamente
- Funciona como una app normal
- **Mapas y notificaciones funcionando al 100%**

---

## 🚀 Paso a Paso: Configuración Inicial

### Paso 1: Instalar EAS CLI

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

### Paso 3: Configurar tu proyecto

```bash
cd app
eas build:configure
```

Esto creará un archivo `eas.json` con la configuración de builds.

---

## 📝 Configuración de eas.json

El archivo `eas.json` debería verse así:

```json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": false
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

**Explicación**:
- `development`: Build para desarrollo con hot reload
- `preview`: Build de prueba sin hot reload
- `production`: Build para subir a tiendas

---

## 🔧 Configuración de app.json

Asegúrate de tener configurado tu `app.json`:

```json
{
  "expo": {
    "name": "UrbanTaxi",
    "slug": "urban-taxi",
    "version": "1.0.0",
    "android": {
      "package": "com.urbantaxi.passenger",
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "FOREGROUND_SERVICE"
      ],
      "config": {
        "googleMaps": {
          "apiKey": "TU_GOOGLE_MAPS_API_KEY_ANDROID"
        }
      }
    },
    "ios": {
      "bundleIdentifier": "com.urbantaxi.passenger",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "UrbanTaxi necesita tu ubicación para mostrarte en el mapa",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "UrbanTaxi necesita tu ubicación para tracking en tiempo real"
      },
      "config": {
        "googleMapsApiKey": "TU_GOOGLE_MAPS_API_KEY_IOS"
      }
    },
    "plugins": [
      "expo-router",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "UrbanTaxi necesita tu ubicación"
        }
      ],
      [
        "react-native-maps",
        {
          "googleMapsApiKey": "TU_GOOGLE_MAPS_API_KEY"
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/images/notification-icon.png",
          "color": "#00B300"
        }
      ]
    ]
  }
}
```

---

## 🏗️ Compilar tu App

### Android Development Build

```bash
cd app
eas build --profile development --platform android
```

**Proceso**:
1. EAS sube tu código a la nube
2. Compila la app en servidores de Expo (~10-15 minutos)
3. Te da un link para descargar el `.apk`

**Instalar en tu teléfono**:
1. Descarga el `.apk` desde el link
2. Transfiere a tu teléfono (USB, email, Drive, etc.)
3. Instala el `.apk` (permite instalación de fuentes desconocidas)
4. ¡Listo! Abre la app y prueba mapas y notificaciones

### iOS Development Build

```bash
cd app
eas build --profile development --platform ios
```

**Proceso**:
1. EAS sube tu código a la nube
2. Compila la app (~15-20 minutos)
3. Te da un link para descargar el `.ipa`

**Instalar en tu iPhone**:

**Opción 1: TestFlight (Recomendado)**
```bash
eas submit --platform ios --profile development
```

**Opción 2: Instalación directa**
- Necesitas registrar tu dispositivo en Apple Developer
- Más complejo, mejor usar TestFlight

---

## 🔄 Flujo de Desarrollo con Development Build

### Primera vez (una sola vez)
```bash
# Compilar y descargar
eas build --profile development --platform android
# Instalar en tu teléfono
```

### Desarrollo diario
```bash
# Iniciar servidor de desarrollo
cd app
npx expo start --dev-client

# Escanea el QR con tu Development Build
# Los cambios se recargan automáticamente (hot reload)
```

**¡No necesitas recompilar cada vez!** Solo cuando:
- Agregas nuevos módulos nativos
- Cambias configuración de plugins
- Actualizas versiones de dependencias nativas

---

## 📊 Monitorear tus Builds

### Ver estado de builds
```bash
eas build:list
```

### Ver builds en el navegador
```bash
eas build:view
```

O visita: https://expo.dev/accounts/[tu-usuario]/projects/app-taxis/builds

---

## 🐛 Solución de Problemas Comunes

### Error: "Google Maps API Key not configured"
**Solución**: Asegúrate de tener tu API key en `app.json`:
```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "AIza..."
    }
  }
}
```

### Error: "Build failed - Out of memory"
**Solución**: Esto es raro, pero si pasa:
```bash
eas build --profile development --platform android --clear-cache
```

### Error: "No bundle identifier"
**Solución**: Agrega en `app.json`:
```json
"android": {
  "package": "com.urbantaxi.passenger"
},
"ios": {
  "bundleIdentifier": "com.urbantaxi.passenger"
}
```

---

## 💡 Tips y Mejores Prácticas

### 1. Usa perfiles diferentes
```bash
# Para desarrollo (con hot reload)
eas build --profile development --platform android

# Para testing (sin hot reload, más estable)
eas build --profile preview --platform android

# Para producción (optimizado, para tiendas)
eas build --profile production --platform android
```

### 2. Compila ambas plataformas a la vez
```bash
eas build --profile development --platform all
```

### 3. Guarda los links de descarga
EAS te envía un email con el link de descarga. Guárdalo para reinstalar si es necesario.

### 4. Actualiza sin recompilar
Usa EAS Update para enviar actualizaciones JavaScript sin recompilar:
```bash
eas update --branch development
```

---

## 📱 Diferencias: Expo Go vs Development Build

| Característica | Expo Go | Development Build |
|----------------|---------|-------------------|
| **Instalación** | Play Store/App Store | Compilas tú mismo |
| **Tiempo setup** | 0 minutos | 10-15 minutos (una vez) |
| **react-native-maps** | ❌ No funciona | ✅ Funciona perfecto |
| **Push notifications** | ❌ No funciona (SDK 53+) | ✅ Funciona perfecto |
| **Hot reload** | ✅ Sí | ✅ Sí |
| **Módulos nativos custom** | ❌ No | ✅ Sí |
| **Producción** | ❌ No | ✅ Sí (mismo código) |

---

## 🎓 Resumen Ejecutivo

### Para empezar HOY:

```bash
# 1. Instalar EAS CLI
npm install -g eas-cli

# 2. Login
eas login

# 3. Configurar proyecto
cd app
eas build:configure

# 4. Compilar Android
eas build --profile development --platform android

# 5. Esperar ~10-15 minutos

# 6. Descargar .apk e instalar en tu teléfono

# 7. Iniciar desarrollo
npx expo start --dev-client

# 8. Escanear QR con tu Development Build
```

### Costos:
- **Gratis**: 30 builds/mes
- **Suficiente para**: Desarrollo completo de tu app
- **Upgrade solo si**: Necesitas más de 30 builds/mes

### ¿Funcionarán mapas y notificaciones?
**¡SÍ! 100% funcionales** en tu Development Build y en producción.

Expo Go es solo una herramienta temporal de desarrollo. Tu app final tendrá todas las funcionalidades.

---

## 🚀 Próximos Pasos

1. **Ahora**: Compila tu primer Development Build
2. **Después**: Prueba mapas y notificaciones en tu teléfono
3. **Luego**: Desarrolla normalmente con hot reload
4. **Finalmente**: Usa el mismo código para producción

¿Listo para empezar? Ejecuta:
```bash
npm install -g eas-cli
eas login
cd app
eas build --profile development --platform android
```

---

## 📞 Soporte

- **Documentación oficial**: https://docs.expo.dev/build/introduction/
- **Discord de Expo**: https://chat.expo.dev/
- **Foro**: https://forums.expo.dev/

---

**¡Tu app de taxis funcionará perfectamente con mapas y notificaciones!** 🚕📍🔔
