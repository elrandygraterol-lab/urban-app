# 📡 Explicación: Cómo la App se Comunica con el Backend

## ✅ Respuesta Corta

**SÍ**, `EXPO_PUBLIC_API_URL=http://192.168.1.200:3000` es la ruta base que la app usa para **TODAS** las comunicaciones con el backend.

---

## 🔍 Cómo Funciona

### 1. Variable de Entorno (`app/.env`)

```env
EXPO_PUBLIC_API_URL=http://192.168.1.200:3000
```

Esta variable se carga automáticamente cuando inicias la app.

### 2. Servicio de API (`app/services/api.ts`)

```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,  // ← Usa la URL del .env
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

El servicio de API usa `EXPO_PUBLIC_API_URL` como **base URL** para todas las peticiones.

### 3. Ejemplos de Peticiones

Cuando la app hace una petición, combina la `baseURL` con la ruta específica:

#### Registro de Usuario
```typescript
api.post('/api/auth/register/passenger', data)
```
**URL completa**: `http://192.168.1.200:3000/api/auth/register/passenger`

#### Login
```typescript
api.post('/api/auth/login', { email, password })
```
**URL completa**: `http://192.168.1.200:3000/api/auth/login`

#### Solicitar Viaje
```typescript
api.post('/api/rides/request', data)
```
**URL completa**: `http://192.168.1.200:3000/api/rides/request`

#### Obtener Perfil
```typescript
api.get('/api/auth/me')
```
**URL completa**: `http://192.168.1.200:3000/api/auth/me`

---

## 📊 Todas las Acciones que Usan Esta URL

### 🔐 Autenticación (`authAPI`)
- ✅ Login: `POST /api/auth/login`
- ✅ Registro Pasajero: `POST /api/auth/register/passenger`
- ✅ Registro Conductor: `POST /api/auth/register/driver`
- ✅ Olvidé Contraseña: `POST /api/auth/forgot-password`
- ✅ Resetear Contraseña: `POST /api/auth/reset-password`
- ✅ Refresh Token: `POST /api/auth/refresh`
- ✅ Logout: `POST /api/auth/logout`
- ✅ Obtener Perfil: `GET /api/auth/me`

### 🚗 Viajes (`rideAPI`)
- ✅ Solicitar Viaje: `POST /api/rides/request`
- ✅ Aceptar Viaje: `POST /api/rides/:id/accept`
- ✅ Rechazar Viaje: `POST /api/rides/:id/reject`
- ✅ Llegar al Pickup: `POST /api/rides/:id/arrive`
- ✅ Iniciar Viaje: `POST /api/rides/:id/start`
- ✅ Completar Viaje: `POST /api/rides/:id/complete`
- ✅ Cancelar Viaje: `POST /api/rides/:id/cancel`
- ✅ Obtener Viaje: `GET /api/rides/:id`
- ✅ Viajes Activos: `GET /api/rides/active`
- ✅ Historial: `GET /api/rides/history`
- ✅ Actualizar Ubicación: `POST /api/rides/:id/location`

### 💳 Pagos (`paymentAPI`)
- ✅ Métodos de Pago: `GET /api/payments/methods`
- ✅ Agregar Método: `POST /api/payments/methods`
- ✅ Eliminar Método: `DELETE /api/payments/methods/:id`
- ✅ Procesar Pago: `POST /api/payments/process`
- ✅ Obtener Recibo: `GET /api/payments/receipts/:id`

### ⭐ Calificaciones (`ratingAPI`)
- ✅ Calificar Conductor: `POST /api/ratings/driver`
- ✅ Calificar Pasajero: `POST /api/ratings/passenger`
- ✅ Obtener Calificación: `GET /api/ratings/driver/:id`

### 👨‍✈️ Conductor (`driverAPI`)
- ✅ Actualizar Disponibilidad: `PUT /api/drivers/availability`
- ✅ Obtener Ganancias: `GET /api/drivers/earnings/:period`
- ✅ Subir Documento: `POST /api/drivers/:id/documents`
- ✅ Obtener Documentos: `GET /api/drivers/:id/documents`
- ✅ Mi Perfil: `GET /api/drivers/me`

### 👤 Usuario (`userAPI`)
- ✅ Obtener Perfil: `GET /api/auth/me`
- ✅ Actualizar Perfil: `PUT /api/users/me`
- ✅ Eliminar Cuenta: `DELETE /api/users/me`

### 🔔 Notificaciones (`notificationAPI`)
- ✅ Registrar Dispositivo: `POST /api/notifications/register-device`
- ✅ Obtener Preferencias: `GET /api/notifications/preferences`
- ✅ Actualizar Preferencias: `PUT /api/notifications/preferences`

---

## 🌐 Flujo Completo de una Petición

```
1. Usuario hace acción en la app (ej: presiona "Registrarse")
   ↓
2. App llama a authAPI.registerPassenger(data)
   ↓
3. Axios usa baseURL del .env: http://192.168.1.200:3000
   ↓
4. Combina con la ruta: /api/auth/register/passenger
   ↓
5. URL completa: http://192.168.1.200:3000/api/auth/register/passenger
   ↓
6. Envía petición HTTP POST con los datos
   ↓
7. Backend recibe la petición en el puerto 3000
   ↓
8. Backend procesa y responde
   ↓
9. App recibe la respuesta
   ↓
10. App muestra resultado al usuario
```

---

## 🔧 Interceptores Automáticos

El servicio de API también agrega automáticamente:

### 1. Token de Autenticación
```typescript
// Se agrega automáticamente a todas las peticiones
headers: {
  Authorization: `Bearer ${token}`
}
```

### 2. Manejo de Errores
- **401 Unauthorized**: Elimina token y redirige a login
- **403 Forbidden**: Acceso denegado
- **404 Not Found**: Recurso no encontrado
- **500+ Server Error**: Error del servidor

---

## 📝 Diferentes Entornos

### Desarrollo Local (Actual)
```env
EXPO_PUBLIC_API_URL=http://192.168.1.200:3000
```
- ✅ Para desarrollo en tu red local
- ✅ Funciona con dispositivos físicos
- ✅ Funciona con emuladores

### Producción (Futuro)
```env
EXPO_PUBLIC_API_URL=https://api.urbantaxi.com
```
- ✅ Dominio real
- ✅ HTTPS (seguro)
- ✅ Accesible desde internet

### Staging (Opcional)
```env
EXPO_PUBLIC_API_URL=https://staging-api.urbantaxi.com
```
- ✅ Para pruebas antes de producción

---

## 🎯 Resumen

| Pregunta | Respuesta |
|----------|-----------|
| ¿Todas las peticiones usan esta URL? | ✅ SÍ |
| ¿Se aplica a login, registro, viajes, etc.? | ✅ SÍ |
| ¿Necesito cambiarla en cada archivo? | ❌ NO, solo en `.env` |
| ¿Debo reiniciar después de cambiarla? | ✅ SÍ, reinicia el servidor de Expo |
| ¿Funciona con dispositivos físicos? | ✅ SÍ, con la IP de red local |
| ¿Funciona con emuladores? | ✅ SÍ, si están en la misma red |

---

## 🚀 Para Cambiar la URL del Backend

1. **Edita `app/.env`**:
   ```env
   EXPO_PUBLIC_API_URL=http://[NUEVA_IP]:3000
   ```

2. **Reinicia el servidor de Expo**:
   ```bash
   # Ctrl+C para detener
   npm run start:dev
   ```

3. **Recarga la app**:
   - Agita el dispositivo
   - Selecciona "Reload"

---

## ✅ Verificación

Para verificar que la URL está correcta, puedes:

1. **Ver los logs de la app**:
   ```
   env: export EXPO_PUBLIC_API_URL
   ```
   Debe mostrar la URL correcta.

2. **Intentar una acción** (ej: registrarse):
   - Si funciona → URL correcta ✅
   - Si falla con "Network request failed" → URL incorrecta ❌

3. **Ver los logs del backend**:
   ```bash
   cd backend
   docker-compose logs -f backend
   ```
   Deberías ver las peticiones llegando.

---

**En resumen**: Sí, `EXPO_PUBLIC_API_URL` es la URL base para **TODA** la comunicación entre la app y el backend. Cambiarla en el `.env` afecta a todas las peticiones automáticamente.
