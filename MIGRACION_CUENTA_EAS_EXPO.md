# Migración de Cuenta EAS Expo por Límite de Builds

## 📋 Situación Común
Has alcanzado el límite mensual de builds gratuitos en tu cuenta de Expo y necesitas cambiar a otra cuenta para continuar compilando tu aplicación.

## 🚀 Proceso Completo Paso a Paso

### 📍 Ubicación del Proyecto
```bash
cd /c/urban-taxis/urban-taxis
```

---

## 🔄 PASO 1: Verificar Cuenta Actual

### 1.1 Verificar cuenta logueada
```bash
eas whoami
```
**Ejemplo de salida:**
```
tupaparandy
javiergraterolpineda@gmail.com

Accounts:
• tupaparandy (Role: Owner)
• tupaparandys-team (Role: Owner)
```

### 1.2 Verificar proyecto actual
```bash
eas project:info
```
**Anotar:**
- **Project ID actual**: `30ef3cd5-fa02-47c3-9994-c57eeb7860be`
- **Nombre proyecto**: `@tupaparandy/app-taxis`

---

## 🔐 PASO 2: Logout de Cuenta Actual

```bash
eas logout
```
**Salida esperada:**
```
Logged out
```

---

## 🔑 PASO 3: Login con Nueva Cuenta

### 3.1 Login interactivo
```bash
eas login
```
- Ingresar: `zhetazio`
- Ingresar contraseña de la nueva cuenta

### 3.2 Verificar nuevo login
```bash
eas whoami
```
**Salida esperada:**
```
zhetazio
habitasoficial@gmail.com

Accounts:
• zhetazio (Role: Owner)
• zhetazios-team (Role: Owner)
```

---

## 🏗️ PASO 4: Configurar Proyecto en Nueva Cuenta

### 4.1 Comentar projectId anterior
**Archivo**: `app.config.js`
```javascript
// Cambiar de:
extra: {
  eas: {
    projectId: '30ef3cd5-fa02-47c3-9994-c57eeb7860be',
  },
}

// A:
extra: {
  eas: {
    // projectId: '30ef3cd5-fa02-47c3-9994-c57eeb7860be', // Comentado para crear nuevo proyecto
  },
}
```

### 4.2 Crear nuevo proyecto en la cuenta
```bash
eas init --force
```
**Salida esperada:**
```
Using default account zhetazio for non-interactive and force mode
- Creating @zhetazio/app-taxis
✔ Created @zhetazio/app-taxis: https://expo.dev/accounts/zhetazio/projects/app-taxis

Nuevo Project ID: 2f0a1436-e1de-4a63-bf42-78a033c62cb9
```

### 4.3 Actualizar app.config.js con nuevo projectId
```javascript
extra: {
  eas: {
    projectId: '2f0a1436-e1de-4a63-bf42-78a033c62cb9', // Nuevo project ID
  },
}
```

### 4.4 Verificar configuración
```bash
eas project:info
```
**Salida esperada:**
```
fullName  @zhetazio/app-taxis
ID        2f0a1436-e1de-4a63-bf42-78a033c62cb9
```

---

## 🔐 PASO 5: Configurar Credenciales Android

### 5.1 Verificar credenciales existentes
```bash
eas credentials:configure-build --platform android --profile production
```

```bash
eas credentials:configure-build --platform android --profile preview
```

**Salida esperada (si ya existen credenciales):**
```
✔ Using build profile: production
✔ Using Keystore from configuration: Build Credentials aL6luLpzZe (default)
```

### 5.2 Configurar para usar credenciales LOCALES (IMPORTANTE)
**Modificar eas.json para forzar uso de keystore local:**
```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "credentialsSource": "local"  // ← ESTA LÍNEA ES CRÍTICA
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle",
        "credentialsSource": "local"  // ← ESTA LÍNEA ES CRÍTICA
      }
    }
  }
}
```

### 5.3 Archivos de credenciales REQUERIDOS
**Asegurar que existen en el proyecto:**
```
📁 urban-taxis/
├── 📄 @zhetazioas__app-taxis.jks         ← Keystore file
├── 📄 keystore-creds.txt                 ← Contraseñas del keystore
│   Keystore password: f8cb6d9f1d7cbdf68370f5f96afc7044
│   Key alias: 59703f4d387e1bac6490e964454d5db4  ← DEBE COINCIDIR
│   Key password: 93ad499958112a607d49529890134453
├── 📄 google-services.json              ← Firebase producción
└── 📄 google-services-preview.json      ← Firebase preview
```

### 5.4 Verificar Key Alias en Expo Dashboard
**SIEMPRE VERIFICAR que el key alias coincide:**
1. Ve a: https://expo.dev/accounts/[TU_CUENTA]/projects/app-taxis/settings/android/credentials
2. Verificar: `Key alias` debe ser: `59703f4d387e1bac6490e964454d5db4`
3. **SI NO COINCIDE**: Configurar `credentialsSource: "local"` en eas.json

### 5.5 Problema común y solución
**Síntoma**: Key alias diferente en Expo Dashboard vs keystore local
**Solución**: Añadir `"credentialsSource": "local"` a eas.json

---

## 🧪 PASO 6: Probar Build con Nueva Cuenta

### 6.1 Build de prueba (preview)
```bash
eas build --profile preview --platform android
```

### 6.2 Build de producción
```bash
eas build --profile production --platform android
```

---

## ⚠️ Consideraciones Importantes

### ✅ Ventajas de este proceso
1. **Mantiene el mismo keystore**: Google Play reconoce la app como la misma
2. **Mantiene configuraciones**: Firebase, Google Maps, etc.
3. **No afecta usuarios**: La app instalada seguirá funcionando
4. **Builds ilimitados**: Rotando entre cuentas

### ❌ Desventajas/Precauciones
1. **Diferente cuenta en Expo Dashboard**
2. **Separación de logs y builds** entre cuentas
3. **Necesidad de recordar** qué cuenta está activa

---

## 🔄 Ciclo de Rotación de Cuentas

### Cuentas disponibles:
1. **tupaparandy** - javiergraterolpineda@gmail.com
2. **zhetazio** - habitasoficial@gmail.com
3. **tupaparandys-team** - (team account)
4. **zhetazios-team** - (team account)

### Cuándo rotar:
- Cuando aparezca: `"This account has used its Android builds from the Free plan this month"`
- El límite se reinicia el **primer día de cada mes**

---

## 🛠️ Solución de Problemas Comunes

### Problema 1: "Entity not authorized"
```bash
Error: Entity not authorized: AppEntity[30ef3cd5-fa02-47c3-9994-c57eeb7860be]
```
**Solución:** Asegurarse de comentar/eliminar el projectId anterior en `app.config.js`

### Problema 2: "Cannot automatically write to dynamic config"
```bash
Warning: Your project uses dynamic app configuration
```
**Solución:** Manualmente actualizar `projectId` en `app.config.js`

### Problema 3: Credenciales no detectadas
```bash
Error: No Android credentials found
```
**Solución:** 
1. Verificar que `@zhetazioas__app-taxis.jks` existe
2. Ejecutar: `eas credentials:configure-build --platform android --profile production`

---

## 📊 Estado Actual (Julio 2026)

### Cuenta Activa: zhetazio
- **Project ID**: `2f0a1436-e1de-4a63-bf42-78a033c62cb9`
- **Keystore**: `@zhetazioas__app-taxis.jks`
- **Credenciales ID**: `aL6luLpzZe`
- **URL Dashboard**: https://expo.dev/accounts/zhetazio/projects/app-taxis

### Próxima Rotación:
- **Cuenta a usar**: `tupaparandys-team` o crear nueva
- **Fecha estimada**: Cuando `zhetazio` alcance límite

---

## 💡 Mejores Prácticas

1. **Mantener backup** de archivos `.jks` y `keystore-creds.txt`
2. **Documentar** todas las cuentas disponibles
3. **Rotar periódicamente** para evitar bloqueos
4. **Verificar builds** en ambas cuentas periódicamente
5. **Usar variables de entorno** para credenciales sensibles

---

## 📞 URLs Importantes

- **Expo Dashboard**: https://expo.dev
- **Documentación EAS**: https://docs.expo.dev/eas/
- **Límites de plan Free**: https://expo.dev/pricing
- **Configuración Android**: https://docs.expo.dev/build-reference/android-credentials/

---

## 🎯 Comando Rápido para Próxima Rotación

```bash
# 1. Logout actual
eas logout

# 2. Login nueva cuenta
eas login

# 3. Configurar proyecto
# (Editar app.config.js con nuevo projectId si es necesario)

# 4. Verificar credenciales
eas credentials:configure-build --platform android --profile production

# 5. Build
eas build --profile preview --platform android
```

---

**Última actualización**: 30 Julio 2026  
**By**: Kiro AI Assistant  
**Proyecto**: Urban Taxis App