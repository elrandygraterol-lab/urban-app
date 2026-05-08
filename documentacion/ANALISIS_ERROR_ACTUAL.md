# Análisis del Error Actual - 27 de Marzo, 2026

## 🔴 ERRORES OBSERVADOS

Después del build exitoso con Firebase configurado, la app muestra estos errores en runtime:

```
ERROR  📍 Context: Notifications
ERROR  💬 Message: Failed to register device token
```

## 🔍 ANÁLISIS DEL PROBLEMA

### 1. Build Exitoso ✅
- El error de prebuild "Path to google-services.json is not defined" fue resuelto
- Se agregaron las configuraciones:
  - `android.googleServicesFile: "./google-services.json"`
  - `ios.googleServicesFile: "./GoogleService-Info.plist"`
- El build en EAS completó exitosamente

### 2. Error en Runtime ❌
El error ocurre en `app/_layout.tsx` cuando se intenta inicializar las notificaciones:

```typescript
const { expoPushToken, error: notificationError } = useNotifications();
```

### 3. Causa Raíz Identificada

El error "Failed to register device token" ocurre en `app/hooks/useNotifications.ts` en la función `registerDeviceToken()`:

```typescript
const registerDeviceToken = async (token: string) => {
  try {
    const { notificationAPI } = await import('@/services/api');
    const response = await notificationAPI.registerDevice({
      token,
      platform,
    });
    // ✅ Si llega aquí, el registro fue exitoso
  } catch (err: any) {
    // ❌ El error ocurre aquí
    console.error('[NOTIFICATIONS] ❌ Error registering device token with backend:', err);
    setError('Failed to register device token');
  }
};
```

**Posibles causas**:
1. **Backend no está corriendo** - El backend en `http://192.168.1.7:3000` no está accesible
2. **Usuario no autenticado** - El token JWT no está presente en la petición
3. **Endpoint no existe** - La ruta `/api/notifications/register-device` no está implementada
4. **Error de red** - Firewall, VPN, o problemas de conectividad

## 📊 ESTADO ACTUAL DEL SISTEMA

### ✅ Lo que SÍ funciona:
- Build de Android completa exitosamente
- Firebase configurado correctamente (solo para satisfacer dependencias nativas)
- App se inicia y muestra la UI
- Navegación funciona

### ❌ Lo que NO funciona:
- Registro del token de Expo Push con el backend
- Esto impide que las notificaciones push funcionen

## 🔧 SOLUCIONES PROPUESTAS

### Solución 1: Verificar que el Backend esté corriendo

```bash
# En la carpeta backend:
cd backend
npm run dev

# Verificar que muestre:
# Server running on port 3000
# Socket.io initialized
# Redis connected
```

**Probar desde el navegador del dispositivo**:
```
http://192.168.1.7:3000
```

Debe mostrar: "UrbanTaxi API is running"

### Solución 2: Verificar la IP del Backend

El archivo `app/.env` debe tener la IP correcta:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.7:3000
```

**Verificar la IP actual del backend**:
```bash
# En Windows:
ipconfig

# Buscar "IPv4 Address" en la sección de tu adaptador de red
```

Si la IP cambió, actualizar el `.env` y reiniciar Metro:
```bash
cd app
# Editar .env con la nueva IP
npx expo start --clear
```

### Solución 3: Agregar Manejo Graceful del Error

Modificar `app/hooks/useNotifications.ts` para que el error no bloquee la app:

```typescript
const registerDeviceToken = async (token: string) => {
  try {
    const platform = Platform.OS as 'android' | 'ios' | 'web';
    
    console.log('[NOTIFICATIONS] Registering device token with backend...', {
      platform,
      tokenPreview: token.substring(0, 20) + '...',
      apiUrl: process.env.EXPO_PUBLIC_API_URL
    });
    
    const { notificationAPI } = await import('@/services/api');
    const response = await notificationAPI.registerDevice({
      token,
      platform,
    });

    console.log('[NOTIFICATIONS] ✅ Device token registered successfully:', response.data);
  } catch (err: any) {
    console.error('[NOTIFICATIONS] ❌ Error registering device token with backend:', err);
    console.error('[NOTIFICATIONS] Error details:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      apiUrl: process.env.EXPO_PUBLIC_API_URL
    });
    
    // ⚠️ NO establecer error en el estado para no bloquear la app
    // El token de Expo Push se obtuvo correctamente, solo falló el registro con backend
    console.warn('[NOTIFICATIONS] ⚠️ Token obtained but not registered with backend. Push notifications may not work until backend is accessible.');
  }
};
```

### Solución 4: Verificar Autenticación

El endpoint `/api/notifications/register-device` probablemente requiere autenticación. Verificar que el token JWT esté presente:

```typescript
// En app/services/api.ts
apiClient.interceptors.request.use(
  async (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('[API] Request:', {
      url: config.url,
      method: config.method,
      hasAuth: !!token
    });
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
```

## 🎯 PLAN DE ACCIÓN INMEDIATO

### Paso 1: Verificar Backend (2 minutos)
```bash
cd backend
npm run dev
```

Abrir navegador en el dispositivo Android:
```
http://192.168.1.7:3000
```

### Paso 2: Verificar Logs del Backend (1 minuto)
Cuando la app intente registrar el token, el backend debe mostrar:
```
POST /api/notifications/register-device
```

Si NO aparece, el problema es de red/conectividad.
Si aparece con error 401, el problema es de autenticación.
Si aparece con error 500, el problema es del backend.

### Paso 3: Verificar Logs de la App (1 minuto)
En Metro bundler, buscar:
```
[NOTIFICATIONS] Registering device token with backend...
[NOTIFICATIONS] Error details: { ... }
```

Los detalles del error dirán exactamente qué está fallando.

### Paso 4: Aplicar Fix Temporal (5 minutos)
Si el backend no está accesible, aplicar la Solución 3 para que el error no bloquee la app.

## 📝 CHECKLIST DE DEBUGGING

- [ ] Backend está corriendo en `http://192.168.1.7:3000`
- [ ] Navegador del dispositivo puede acceder a `http://192.168.1.7:3000`
- [ ] Archivo `app/.env` tiene la IP correcta
- [ ] Metro bundler reiniciado después de cambiar `.env`
- [ ] Usuario está autenticado (tiene token JWT)
- [ ] Logs del backend muestran la petición POST
- [ ] Logs de la app muestran detalles del error

## 🔄 HISTORIAL DE PROBLEMAS

### Problema 1: Firebase Residue Error ✅ RESUELTO
- **Solución**: Agregar Firebase config files y plugin
- **Estado**: Build exitoso

### Problema 2: Build Error "Path to google-services.json not defined" ✅ RESUELTO
- **Solución**: Agregar `googleServicesFile` en `app.config.js`
- **Estado**: Build exitoso

### Problema 3: Runtime Error "Failed to register device token" ⏳ EN PROGRESO
- **Causa**: Backend no accesible o error de autenticación
- **Próximo paso**: Verificar backend y logs

## 💡 CONCLUSIÓN

El problema actual NO es de Firebase ni de la configuración de notificaciones. El problema es que:

1. ✅ El token de Expo Push se obtiene correctamente
2. ❌ El registro del token con el backend falla

**Esto significa que**:
- Las notificaciones push PUEDEN funcionar si se envían directamente con el token de Expo
- Pero el backend no sabe qué token usar para cada usuario
- Necesitamos que el backend esté accesible para registrar el token

**Próximo paso**: Verificar que el backend esté corriendo y accesible desde el dispositivo Android.

---

**Fecha**: 27 de Marzo, 2026  
**Estado**: Debugging en progreso  
**Prioridad**: Alta - Bloquea funcionalidad de notificaciones
