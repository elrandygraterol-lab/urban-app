# 🚀 COMPILAR AHORA - Guía Rápida

## ⚡ Comandos para Copiar y Pegar

### 1️⃣ Verificar que todo esté listo

```bash
cd app
npm run check:eas
```

Este comando verifica:
- ✅ Node.js instalado
- ✅ EAS CLI instalado
- ✅ Login en Expo
- ✅ Configuración correcta
- ✅ Google Maps API Key

---

### 2️⃣ Instalar EAS CLI (si no lo tienes)

```bash
npm install -g eas-cli
```

---

### 3️⃣ Login en Expo

```bash
eas login
```

**Si no tienes cuenta**, créala:
```bash
eas register
```

---

### 4️⃣ Configurar EAS (primera vez)

```bash
cd app
eas build:configure
```

Responde `Yes` a todo.

---

### 5️⃣ COMPILAR ANDROID

```bash
npm run build:dev:android
```

**Tiempo**: 10-15 minutos ☕

**Resultado**: Link para descargar APK

---

### 6️⃣ Descargar e Instalar APK

1. Copia el link del APK que te da EAS
2. Descarga el archivo `.apk`
3. Transfiere a tu teléfono (USB, WhatsApp, Drive)
4. Instala en tu teléfono
5. Permite "Instalación de fuentes desconocidas"

---

### 7️⃣ Iniciar Desarrollo

```bash
npm run start:dev
```

---

### 8️⃣ Conectar tu Teléfono

1. Abre la app "app-taxis (dev)" en tu teléfono
2. Escanea el QR de tu terminal
3. ¡Listo! 🎉

---

## 📱 Desarrollo Diario

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

## 🎯 Comandos Útiles

```bash
# Verificar configuración
npm run check:eas

# Compilar Android Development
npm run build:dev:android

# Compilar iOS Development
npm run build:dev:ios

# Compilar ambas plataformas
npm run build:dev:all

# Iniciar servidor para Development Build
npm run start:dev

# Ver lista de builds
eas build:list

# Ver detalles de un build
eas build:view
```

---

## ⚠️ IMPORTANTE: Google Maps API Key

Antes de compilar, configura tu Google Maps API Key en `app.json`:

```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "TU_API_KEY_AQUI"
        }
      }
    }
  }
}
```

**Obtener API Key**:
1. https://console.cloud.google.com/
2. Crear proyecto
3. Habilitar "Maps SDK for Android"
4. Crear credenciales (API Key)
5. Copiar a `app.json`

---

## 🐛 Problemas Comunes

### "eas: command not found"
```bash
npm install -g eas-cli
```

### "Not logged in"
```bash
eas login
```

### "Build failed"
```bash
eas build:view
eas build --profile development --platform android --clear-cache
```

### "Cannot install APK"
- Configuración → Seguridad → Permitir instalación de fuentes desconocidas

---

## ✅ Checklist Rápido

- [ ] EAS CLI instalado
- [ ] Login en Expo
- [ ] Google Maps API Key configurada
- [ ] Teléfono Android listo

---

## 🚀 TODO EN UNO (Si ya tienes todo configurado)

```bash
cd app && npm run build:dev:android
```

---

## 📞 Ayuda

- **Guía completa**: `EAS_BUILD_GUIDE.md`
- **Flujo visual**: `FLUJO_DESARROLLO_VISUAL.md`
- **Comparación**: `COMPARACION_EXPO_GO_VS_DEVELOPMENT_BUILD.md`
- **Docs oficiales**: https://docs.expo.dev/build/introduction/

---

## 🎉 Resultado Final

Después de compilar tendrás:
- ✅ App con mapas funcionando al 100%
- ✅ Notificaciones push funcionando al 100%
- ✅ Hot reload para desarrollo rápido
- ✅ Sin errores de Expo Go
- ✅ La misma app que subirás a producción

**¡Empieza ahora!** 🚀
