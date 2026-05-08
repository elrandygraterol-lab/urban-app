# 🚀 Inicio Rápido: Compilar tu App con EAS Build

## ⏱️ Tiempo estimado: 20 minutos

---

## Paso 1: Instalar EAS CLI (2 minutos)

Abre tu terminal y ejecuta:

```bash
npm install -g eas-cli
```

---

## Paso 2: Crear cuenta / Login (3 minutos)

### Si ya tienes cuenta Expo:
```bash
eas login
```

### Si NO tienes cuenta:
```bash
eas register
```

Sigue las instrucciones en pantalla.

---

## Paso 3: Configurar tu proyecto (1 minuto)

```bash
cd app
eas build:configure
```

Responde las preguntas:
- **"Would you like to automatically create an EAS project?"** → `Yes`
- **"Generate a new Android Keystore?"** → `Yes`

Esto creará el archivo `eas.json` (ya está creado en tu proyecto).

---

## Paso 4: Compilar Android (15 minutos)

```bash
eas build --profile development --platform android
```

**Lo que verás**:
```
✔ Build credentials
✔ Uploading project files
✔ Building...
✔ Build finished!

Build URL: https://expo.dev/accounts/[tu-usuario]/projects/app-taxis/builds/[build-id]
APK URL: https://expo.dev/artifacts/[artifact-id]
```

**Mientras esperas** (~10-15 minutos):
- Puedes cerrar la terminal, el build continúa en la nube
- Recibirás un email cuando termine
- Puedes ver el progreso en: https://expo.dev

---

## Paso 5: Descargar e Instalar (5 minutos)

### En tu computadora:
1. Copia el link del APK que te dio EAS
2. Descarga el archivo `.apk`

### En tu teléfono Android:
1. Transfiere el `.apk` a tu teléfono (USB, email, Drive, WhatsApp, etc.)
2. Abre el archivo `.apk` en tu teléfono
3. Si te pide "Permitir instalación de fuentes desconocidas" → Acepta
4. Instala la app
5. ¡Abre la app!

---

## Paso 6: Conectar al servidor de desarrollo

### En tu computadora:
```bash
cd app
npx expo start --dev-client
```

### En tu teléfono:
1. Abre la app que acabas de instalar
2. Escanea el QR que aparece en la terminal
3. ¡Listo! La app se conectará y verás tu código

**Hot Reload**: Cualquier cambio en tu código se reflejará automáticamente en la app.

---

## 🎉 ¡Felicidades!

Ahora tienes:
- ✅ Una app con mapas funcionando
- ✅ Notificaciones push funcionando
- ✅ Hot reload para desarrollo rápido
- ✅ La misma app que subirás a producción

---

## 🔄 Desarrollo Diario

### NO necesitas recompilar cada día

Solo ejecuta:
```bash
cd app
npx expo start --dev-client
```

Y escanea el QR con tu Development Build.

### ¿Cuándo SÍ necesitas recompilar?

Solo cuando:
- Agregas un nuevo módulo nativo (ej: `expo install expo-camera`)
- Cambias configuración en `app.json` (plugins, permisos)
- Actualizas versiones de dependencias nativas

---

## 📱 Para iOS (Opcional)

Si también quieres probar en iPhone:

```bash
eas build --profile development --platform ios
```

**Nota**: Para iOS necesitarás:
- Una cuenta de Apple Developer ($99/año)
- O usar TestFlight (gratis pero requiere cuenta Apple Developer)

**Recomendación**: Empieza con Android, es más fácil y rápido.

---

## 💰 Resumen de Costos

| Servicio | Costo | Límite |
|----------|-------|--------|
| **EAS Build (Free)** | $0 | 30 builds/mes |
| **Expo Account** | $0 | Gratis |
| **Android Testing** | $0 | Gratis |
| **iOS Testing** | $99/año | Apple Developer |

**Total para empezar**: $0 (solo Android)

---

## 🐛 Problemas Comunes

### "Command not found: eas"
**Solución**:
```bash
npm install -g eas-cli
```

### "Not logged in"
**Solución**:
```bash
eas login
```

### "Build failed"
**Solución**:
```bash
# Ver logs detallados
eas build:view

# Limpiar caché y reintentar
eas build --profile development --platform android --clear-cache
```

### "Cannot install APK"
**Solución**:
- Ve a Configuración → Seguridad → Permitir instalación de fuentes desconocidas
- O busca "Install unknown apps" en configuración

---

## 📞 ¿Necesitas Ayuda?

1. **Lee la guía completa**: `app/EAS_BUILD_GUIDE.md`
2. **Documentación oficial**: https://docs.expo.dev/build/introduction/
3. **Discord de Expo**: https://chat.expo.dev/

---

## 🎯 Comandos Rápidos de Referencia

```bash
# Login
eas login

# Compilar Android Development
eas build --profile development --platform android

# Compilar iOS Development
eas build --profile development --platform ios

# Compilar ambas plataformas
eas build --profile development --platform all

# Ver lista de builds
eas build:list

# Ver detalles de un build
eas build:view [build-id]

# Iniciar servidor de desarrollo
npx expo start --dev-client

# Limpiar caché
eas build --clear-cache
```

---

## ✅ Checklist

Antes de compilar, asegúrate de tener:

- [ ] Node.js instalado
- [ ] Cuenta de Expo creada
- [ ] EAS CLI instalado (`npm install -g eas-cli`)
- [ ] Login en EAS (`eas login`)
- [ ] Proyecto configurado (`eas build:configure`)
- [ ] Google Maps API Key configurada en `app.json`
- [ ] Teléfono Android para testing

---

## 🚀 ¡Empieza Ahora!

```bash
# Copia y pega estos comandos uno por uno:

npm install -g eas-cli
eas login
cd app
eas build:configure
eas build --profile development --platform android
```

**Tiempo total**: ~20 minutos (la mayoría es esperar la compilación)

**Resultado**: Una app completamente funcional con mapas y notificaciones en tu teléfono 🎉
