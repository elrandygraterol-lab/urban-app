# Guía Completa: Notificaciones Push iOS con EAS

## Cómo funciona el sistema (flujo completo)

Antes de los pasos, es importante entender qué pasa por debajo cuando llega una notificación a un iPhone:

```
[Tu Backend]
    │
    │  1. Evento ocurre (ej: nuevo viaje disponible)
    │  2. Llama a Expo Push API con el ExponentPushToken del conductor
    ▼
[Expo Push Service - api.expo.io]
    │
    │  3. Valida el token
    │  4. Reenvía el mensaje a Apple usando la APNs Key
    ▼
[APNs - Apple Push Notification service]
    │
    │  5. Apple verifica que la app tiene permiso
    │  6. Entrega la notificación al dispositivo
    ▼
[iPhone del conductor]
    │
    │  7. iOS muestra la notificación
    │  8. El conductor puede aceptar/rechazar desde la notificación
    ▼
[Tu App (useNotifications.ts)]
    │
    │  9. handleNotificationResponse() procesa la acción
    │  10. Llama rideAPI.acceptRide() o rejectRide()
    ▼
[Tu Backend]
```

### Por qué necesitas cada pieza

| Pieza | Para qué sirve |
|-------|---------------|
| **Apple Developer Account** | Sin esto Apple no te deja enviar notificaciones a iPhones. Es el "permiso" de Apple para que tu app exista en su ecosistema |
| **APNs Key** | Es la llave criptográfica que autoriza a Expo a hablar con Apple en nombre de tu app. Sin ella, Apple rechaza todos los mensajes |
| **GoogleService-Info.plist** | Firebase lo necesita para inicializarse en iOS. Expo también lo usa internamente para el canal de notificaciones |
| **ExponentPushToken** | Es el identificador único del dispositivo+app. Tu backend lo guarda y lo usa para saber a qué iPhone enviar cada notificación |
| **Development Build** | Es una versión de tu app compilada nativamente que incluye `expo-dev-client`. A diferencia de Expo Go, sí soporta push notifications reales |

---

## Lo que ya tienes configurado ✅

Tu proyecto ya tiene todo el código listo. Solo falta la parte de cuentas y compilación:

- `GoogleService-Info.plist` con `BUNDLE_ID: com.urbantaxi.passenger` ✅
- `app.config.js` con `ios.googleServicesFile` apuntando al plist ✅
- `projectId: 18144406-d79f-4baa-8918-1f31ecedd9a5` en `extra.eas` ✅
- `eas.json` con perfiles `development`, `preview`, `production` ✅
- `expo-dev-client` instalado ✅
- `useNotifications.ts` con permisos iOS y categorías RIDE_REQUEST ✅
- `expoPushService.ts` con `categoryIdentifier` para ride_request ✅

---

## PASO 1 — Cuenta Apple Developer

### Qué es y por qué la necesitas

Apple controla completamente quién puede enviar notificaciones a iPhones. Para hacerlo necesitas estar registrado como desarrollador en su programa. Esto incluye:

- Poder firmar apps (code signing) — iOS no instala apps sin firma
- Poder registrar dispositivos de prueba
- Poder crear APNs Keys para notificaciones push
- Poder distribuir apps via TestFlight o App Store

### Cómo crearla

1. Ve a [developer.apple.com/programs](https://developer.apple.com/programs)
2. Haz clic en **"Enroll"**
3. Inicia sesión con tu Apple ID (o crea uno si no tienes)
4. Selecciona **"Individual / Sole Proprietor / Single Person Business"** si es personal
5. Completa el formulario con tus datos
6. Paga los $99 USD anuales
7. Apple tarda entre unos minutos y 48 horas en activar la cuenta

> **Nota**: Si solo quieres probar en simulador no necesitas la cuenta de pago, pero para dispositivo físico real es obligatoria.

---

## PASO 2 — Instalar EAS CLI

EAS (Expo Application Services) es el servicio de Expo que compila tu app en la nube. No necesitas Mac porque EAS tiene Macs en sus servidores.

```bash
npm install -g eas-cli

# Verificar que instaló correctamente
eas --version
# Debe mostrar algo como: eas-cli/15.x.x
```

---

## PASO 3 — Login en Expo y vincular proyecto

```bash
# Login con tu cuenta de expo.dev
eas login

# Entrar a la carpeta de la app
cd app

# Verificar que el proyecto está vinculado correctamente
eas project:info
```

Debe mostrar:
```
Project: app-taxis
ID: 18144406-d79f-4baa-8918-1f31ecedd9a5
```

Si no está vinculado:
```bash
eas init --id 18144406-d79f-4baa-8918-1f31ecedd9a5
```

---

## PASO 4 — Configurar APNs Key (lo más importante)

### Qué es una APNs Key

Es un archivo `.p8` que Apple genera. Contiene una clave criptográfica privada que le dice a Apple "este servidor tiene permiso para enviar notificaciones a la app `com.urbantaxi.passenger`". 

Expo la guarda en sus servidores y la usa cada vez que tu backend le pide enviar una notificación a un iPhone.

### Cómo configurarla con EAS (automático)

```bash
cd app
eas credentials --platform ios
```

El CLI te mostrará un menú interactivo:

```
? Select a build profile
  > development
    preview
    production
```

Selecciona **development**.

```
? What do you want to do?
  > Set up push notifications
    Manage credentials
```

Selecciona **"Set up push notifications"**.

```
? How do you want to configure your APNs Key?
  > Generate a new APNs Key (recommended)
    Use an existing APNs Key
```

Selecciona **"Generate a new APNs Key"**.

EAS te pedirá que inicies sesión con tu Apple ID (el de la cuenta Developer). Luego **automáticamente**:
1. Entra a tu Apple Developer account via API
2. Crea una APNs Key nueva
3. La descarga
4. La sube a los servidores de Expo
5. La asocia a tu `projectId`

No tienes que tocar nada en el portal de Apple manualmente.

### Verificar que quedó configurada

```bash
eas credentials --platform ios
# Debe mostrar: APNs Key: ✅ Configured
```

---

## PASO 5 — Registrar tu iPhone como dispositivo de prueba

Como el perfil `development` usa `distribution: internal`, Apple solo permite instalar la app en dispositivos previamente registrados.

```bash
eas device:create
```

Esto genera un link especial. **Desde tu iPhone**, abre ese link en Safari (no Chrome, debe ser Safari). Descarga e instala el perfil de configuración que aparece. Esto registra el UDID de tu iPhone en tu Apple Developer account.

Luego EAS puede incluir ese dispositivo en el provisioning profile del build.

---

## PASO 6 — Compilar con EAS

```bash
cd app
npm run build:dev:ios
# equivale a: eas build --profile development --platform ios --clear-cache
```

### Qué pasa durante el build

1. EAS sube tu código fuente a sus servidores
2. Un Mac en la nube de EAS ejecuta `expo prebuild` para generar el proyecto Xcode nativo
3. Xcode compila la app con tu `GoogleService-Info.plist`, los plugins de `expo-notifications`, Firebase, etc.
4. EAS firma el `.ipa` con tu Apple Developer certificate y el provisioning profile que incluye tu iPhone
5. Sube el `.ipa` a sus servidores y te manda el link

El proceso tarda entre **10 y 20 minutos**.

Verás en la terminal algo como:
```
Build started
Waiting for build to complete...
✅ Build finished
Install URL: https://expo.dev/artifacts/eas/...
```

---

## PASO 7 — Instalar la app en el iPhone

Tienes dos opciones:

**Opción A — QR desde la terminal**
Al terminar el build, EAS muestra un QR. Escanéalo con la cámara del iPhone. Se abre Safari y descarga el `.ipa`.

**Opción B — Link por email**
EAS también manda un email con el link de descarga. Ábrelo desde Safari en el iPhone.

### Si aparece "No se puede instalar la app"

Ve a **Ajustes → General → VPN y gestión de dispositivos** → busca tu cuenta de desarrollador → toca **"Confiar en [tu nombre]"**.

---

## PASO 8 — Correr en modo desarrollo

Con la app instalada en el iPhone, en tu PC:

```bash
cd app
npm run start:dev
# equivale a: expo start --dev-client
```

La terminal muestra un QR. Abre la app instalada en el iPhone (se llama "app-taxis" con el ícono de tu app, no Expo Go). Escanea el QR. La app se conecta a Metro y tienes hot reload funcionando.

---

## PASO 9 — Aceptar permisos de notificaciones

La primera vez que la app abre en el iPhone, iOS muestra el diálogo:

```
"app-taxis" quiere enviarte notificaciones
[No permitir]  [Permitir]
```

Toca **Permitir**. Esto dispara el código en `useNotifications.ts`:

```typescript
// Se ejecuta automáticamente
const { status } = await Notifications.requestPermissionsAsync({
  ios: {
    allowAlert: true,
    allowBadge: true,
    allowSound: true,
  },
});
```

Luego la app obtiene el token y lo registra en tu backend. En los logs de Metro verás:

```
[NOTIFICATIONS] ✅ Expo Push Token obtained: ExponentPushToken[xxxxxxxxxxxxxx]
[NOTIFICATIONS] ✅ Device token registered successfully
```

Ese token queda guardado en la tabla `NotificationToken` de tu base de datos.

---

## PASO 10 — Verificar que las notificaciones llegan

### Prueba rápida desde expo.dev

1. Ve a [expo.dev](https://expo.dev) → tu proyecto → **Push Notifications**
2. Pega el `ExponentPushToken[...]` que viste en los logs
3. Escribe un título y mensaje
4. Envía

Si el iPhone muestra la notificación, todo funciona.

### Prueba desde tu backend

```bash
POST /api/notifications/test
Authorization: Bearer <tu_jwt_token>
```

### Prueba de notificación de viaje (RIDE_REQUEST)

Cuando el backend envía una notificación de tipo `ride_request`, el iPhone muestra la notificación con dos botones:
- **Aceptar** — llama `rideAPI.acceptRide(rideId)` directamente sin abrir la app
- **Rechazar** — llama `rideAPI.rejectRide(rideId)` sin abrir la app

Esto funciona porque el backend incluye `categoryIdentifier: 'RIDE_REQUEST'` en el payload, y la app registró esa categoría con las acciones al inicializarse.

---

## Para producción (App Store / TestFlight)

Cuando quieras distribuir a usuarios reales:

```bash
# Build de producción
npm run build:prod:ios
# equivale a: eas build --profile production --platform ios

# Subir a App Store Connect / TestFlight
eas submit --platform ios
```

Para producción necesitas además:
- Crear el app en [App Store Connect](https://appstoreconnect.apple.com)
- Tener un certificado de distribución (EAS lo gestiona automáticamente)

---

## Resumen de pasos

| # | Acción | Dónde | Una sola vez |
|---|--------|-------|:---:|
| 1 | Crear cuenta Apple Developer ($99/año) | developer.apple.com | ✅ |
| 2 | `npm install -g eas-cli` | Terminal PC | ✅ |
| 3 | `eas login` | Terminal PC | ✅ |
| 4 | `eas credentials --platform ios` → APNs Key | Terminal PC | ✅ |
| 5 | `eas device:create` → registrar iPhone | Terminal PC + iPhone | ✅ |
| 6 | `npm run build:dev:ios` (esperar ~15min) | Terminal PC | Por cada cambio nativo |
| 7 | Instalar `.ipa` desde link de EAS | iPhone | Por cada build |
| 8 | `npm run start:dev` | Terminal PC | Cada sesión de desarrollo |
| 9 | Aceptar permisos en el iPhone | iPhone | ✅ |
| 10 | Verificar token en logs de Metro | Terminal PC | ✅ |

---

## Errores comunes

### "No devices registered"
Olvidaste el paso 5. Ejecuta `eas device:create` y vuelve a compilar.

### "Push token not obtained"
- Verifica que aceptaste los permisos de notificaciones en el iPhone
- Verifica que el `projectId` en `app.config.js` coincide con el de expo.dev

### "APNs error: InvalidProviderToken"
La APNs Key expiró o fue revocada. Vuelve a ejecutar `eas credentials --platform ios` y genera una nueva.

### La app no se instala ("Untrusted Developer")
Ve a **Ajustes → General → VPN y gestión de dispositivos** → confía en tu cuenta de desarrollador.

### Las notificaciones llegan en foreground pero no en background
Verifica que `setNotificationHandler` está configurado en `useNotifications.ts` (ya está en tu código).
