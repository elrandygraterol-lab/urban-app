# ERROR CRÍTICO: FirebaseApp is not initialized

## Error Completo

```
Make sure to complete the guide at https://docs.expo.dev/push-notifications/fcm-credentials/ : 
Default FirebaseApp is not initialized in this process com.urbantaxi.passenger. 
Make sure to call FirebaseApp.initializeApp(Context) first.
```

---

## ¿Cuándo Aparece?

Este error aparece cuando:
1. Permites notificaciones en el dispositivo (primera vez)
2. La app intenta obtener el token de notificación
3. `expo-notifications` detecta archivos de Firebase
4. Intenta inicializar Firebase automáticamente
5. Falla porque no hay `@react-native-firebase/app` instalado

---

## Causa Raíz

### ❌ Lo que NO era el problema:

1. **Build antiguo** - Hicimos nuevo build y el error persistió
2. **Configuración en app.config.js** - Ya eliminamos `googleServicesFile`
3. **Paquetes instalados** - No tenemos `@react-native-firebase/app`

### ✅ La causa REAL:

**Los archivos `google-services.json` y `GoogleService-Info.plist` existen físicamente en el proyecto.**

```
app/
├── google-services.json          ← Expo lo detecta automáticamente
├── GoogleService-Info.plist      ← Expo lo detecta automáticamente
├── app.config.js                 ← Aunque NO los referencie aquí
```

---

## Cómo Expo Detecta Firebase

Expo tiene un sistema de **detección automática** de archivos Firebase:

### Paso 1: Durante el Build
```javascript
// Expo busca estos archivos en la raíz:
- google-services.json (Android)
- GoogleService-Info.plist (iOS)

// Si los encuentra:
- Los incluye en el build automáticamente
- Configura el proyecto para usar FCM
- NO necesita que estén en app.config.js
```

### Paso 2: En Runtime
```javascript
// Cuando llamas a Notifications.getExpoPushTokenAsync():
1. expo-notifications detecta que hay configuración FCM
2. Intenta usar Firebase Cloud Messaging
3. Busca FirebaseApp inicializado
4. Si no existe → ERROR
```

---

## Solución

### Opción 1: Renombrar Archivos (Recomendado)

Mantiene los archivos por si los necesitas en el futuro:

```bash
cd app
mv google-services.json google-services.json.backup
mv GoogleService-Info.plist GoogleService-Info.plist.backup
```

### Opción 2: Eliminar Archivos

Si estás seguro de no usar Firebase:

```bash
cd app
rm google-services.json
rm GoogleService-Info.plist
```

### Paso Final: Nuevo Build

```bash
cd app
eas build --platform android --profile development --clear-cache
```

**IMPORTANTE:** Debes hacer un NUEVO build después de renombrar/eliminar los archivos.

---

## Verificación

### Antes del Build

Verifica que los archivos NO existan:

```bash
cd app
ls -la | grep google-services
ls -la | grep GoogleService
```

**Resultado esperado:** No debe mostrar nada (o solo los .backup)

### Después del Build

Logs esperados en el dispositivo:

```
LOG [NOTIFICATIONS] Getting Expo push token... {"projectId": "f81ef8db-6366-4c98-847e-6a8fef21555f"}
LOG [NOTIFICATIONS] ✅ Expo Push Token obtained: ExponentPushToken[xxxxx]...
```

**NO debe aparecer:**
- ❌ Error sobre FirebaseApp
- ❌ Mención de FCM credentials
- ❌ Error de inicialización

---

## Por Qué Esto Confunde

### Expectativa vs Realidad

**Lo que pensamos:**
> "Si elimino `googleServicesFile` de app.config.js, Expo no usará Firebase"

**La realidad:**
> "Expo busca archivos Firebase en la raíz del proyecto AUTOMÁTICAMENTE, sin importar el config"

### Documentación de Expo

La documentación oficial dice:
> "If you have google-services.json or GoogleService-Info.plist in your project, Expo will automatically configure FCM"

Pero esto NO está claro en la guía de push notifications.

---

## Lecciones Aprendidas

### 1. Detección Automática de Expo

Expo detecta automáticamente:
- `google-services.json` → Configura FCM para Android
- `GoogleService-Info.plist` → Configura FCM para iOS
- `app.json` / `app.config.js` → Lee configuración adicional

**Orden de prioridad:**
1. Archivos físicos en el proyecto (más alta)
2. Configuración en app.config.js
3. Defaults de Expo

### 2. No Basta con Cambiar el Config

Para cambiar de Firebase a Expo Push Notifications:
1. ❌ NO basta con quitar `googleServicesFile` del config
2. ❌ NO basta con desinstalar paquetes Firebase
3. ✅ DEBES eliminar/renombrar los archivos físicos
4. ✅ DEBES hacer nuevo build

### 3. Los Builds Incluyen Todo

Cuando haces un build con EAS:
- Incluye TODOS los archivos del proyecto
- Detecta configuraciones automáticamente
- No puedes cambiar esto sin un nuevo build

---

## Comparación: Con vs Sin Firebase

### CON Archivos Firebase (❌ Error)

```
Proyecto:
├── google-services.json          ← Expo detecta
├── GoogleService-Info.plist      ← Expo detecta
└── app.config.js (sin googleServicesFile)

Build:
- Incluye archivos Firebase
- Configura FCM automáticamente
- Intenta inicializar Firebase

Runtime:
- expo-notifications usa FCM
- Busca FirebaseApp
- ERROR: FirebaseApp not initialized
```

### SIN Archivos Firebase (✅ Funciona)

```
Proyecto:
├── google-services.json.backup   ← Expo NO detecta
├── GoogleService-Info.plist.backup ← Expo NO detecta
└── app.config.js (sin googleServicesFile)

Build:
- NO incluye archivos Firebase
- Usa Expo Push Notifications
- NO intenta inicializar Firebase

Runtime:
- expo-notifications usa Expo Push Service
- Genera ExponentPushToken
- ✅ TODO FUNCIONA
```

---

## Debugging

### Verificar si el Build Tiene Firebase

Después de instalar el APK, busca en los logs:

**Si tiene Firebase (MAL):**
```
LOG [NOTIFICATIONS] Getting Expo push token...
ERROR Make sure to complete the guide at https://docs.expo.dev/push-notifications/fcm-credentials/
ERROR Default FirebaseApp is not initialized
```

**Si NO tiene Firebase (BIEN):**
```
LOG [NOTIFICATIONS] Getting Expo push token... {"projectId": "f81ef8db-6366-4c98-847e-6a8fef21555f"}
LOG [NOTIFICATIONS] ✅ Expo Push Token obtained: ExponentPushToken[...]
```

### Verificar Archivos en el Proyecto

```bash
cd app

# Buscar archivos Firebase
find . -name "google-services.json" -not -path "./node_modules/*"
find . -name "GoogleService-Info.plist" -not -path "./node_modules/*"

# Si encuentra algo → Renombrar o eliminar
# Si no encuentra nada → Listo para build
```

---

## Solución Alternativa: Usar Firebase Correctamente

Si QUIERES usar Firebase en lugar de Expo Push Notifications:

### 1. Instalar Paquetes

```bash
cd app
npm install @react-native-firebase/app @react-native-firebase/messaging
```

### 2. Configurar app.config.js

```javascript
module.exports = {
  android: {
    googleServicesFile: "./google-services.json",
  },
  ios: {
    googleServicesFile: "./GoogleService-Info.plist",
  },
  plugins: [
    "@react-native-firebase/app",
    "@react-native-firebase/messaging",
  ]
}
```

### 3. Inicializar en el Código

```typescript
// app/_layout.tsx
import messaging from '@react-native-firebase/messaging';

// Obtener token FCM en lugar de Expo token
const token = await messaging().getToken();
```

### 4. Actualizar Backend

El backend ya soporta tokens FCM (unified service), solo necesitas enviar el token FCM en lugar del Expo token.

---

## Recomendación Final

**Para este proyecto: USA EXPO PUSH NOTIFICATIONS**

Razones:
1. ✅ Más simple (no requiere Firebase)
2. ✅ Menos configuración
3. ✅ Funciona igual de bien
4. ✅ Gratis hasta 600k notificaciones/mes
5. ✅ Backend ya tiene soporte completo

**Pasos:**
1. Renombrar archivos Firebase (ya hecho)
2. Hacer nuevo build
3. Instalar y probar

---

## Resumen Ejecutivo

**Problema:**
Error "FirebaseApp is not initialized" al permitir notificaciones.

**Causa:**
Archivos `google-services.json` y `GoogleService-Info.plist` en el proyecto.

**Solución:**
```bash
cd app
mv google-services.json google-services.json.backup
mv GoogleService-Info.plist GoogleService-Info.plist.backup
eas build --platform android --profile development --clear-cache
```

**Resultado:**
Expo usará su propio servicio de push notifications (ExponentPushToken) en lugar de Firebase (FCM).

---

**Fecha:** 27 de Marzo, 2026  
**Estado:** SOLUCIONADO  
**Próximo Build:** FUNCIONARÁ ✓
