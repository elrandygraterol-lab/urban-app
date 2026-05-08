# 🎯 COMANDOS EXACTOS - Copia y Pega

## ⚡ Ejecuta estos comandos en orden

### 1. Instalar EAS CLI

```bash
npm install -g eas-cli
```

---

### 2. Login en Expo

```bash
eas login
```

**Si no tienes cuenta**, ejecuta:
```bash
eas register
```

---

### 3. Ir a la carpeta de la app

```bash
cd app
```

---

### 4. Verificar configuración

```bash
npm run check:eas
```

**Si hay errores**, corrígelos antes de continuar.

---

### 5. Configurar EAS (primera vez)

```bash
eas build:configure
```

**Responde**:
- "Would you like to automatically create an EAS project?" → `Yes` (Enter)
- "Generate a new Android Keystore?" → `Yes` (Enter)

---

### 6. COMPILAR ANDROID

```bash
npm run build:dev:android
```

**Espera 10-15 minutos** ☕

---

### 7. Descargar APK

Cuando termine, EAS te dará un link como:
```
https://expo.dev/artifacts/eas/abc123.apk
```

Copia el link y descarga el APK.

---

### 8. Instalar APK en tu teléfono

1. Transfiere el APK a tu teléfono (USB, WhatsApp, Drive)
2. Abre el archivo APK en tu teléfono
3. Permite "Instalación de fuentes desconocidas"
4. Instala la app

---

### 9. Iniciar servidor de desarrollo

```bash
npm run start:dev
```

---

### 10. Conectar tu teléfono

1. Abre la app "app-taxis (dev)" en tu teléfono
2. Escanea el QR que aparece en tu terminal
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

## 🔄 Comandos Útiles

```bash
# Ver lista de builds
eas build:list

# Ver detalles de un build
eas build:view

# Ver quién está logueado
eas whoami

# Limpiar caché y recompilar
eas build --profile development --platform android --clear-cache
```

---

## ⚠️ IMPORTANTE

Antes de compilar, asegúrate de tener tu Google Maps API Key configurada en `app/app.json`.

Si no la tienes:
1. Ve a: https://console.cloud.google.com/
2. Crea un proyecto
3. Habilita "Maps SDK for Android"
4. Crea una API Key
5. Copia la API Key a `app/app.json`

---

## 🎉 ¡Eso es todo!

En 20 minutos tendrás tu app con mapas y notificaciones funcionando.

**¿Listo? Empieza con el comando 1.** 🚀
