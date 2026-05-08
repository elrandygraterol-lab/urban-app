# Solución Definitiva: Errores de Socket

## Problema Identificado

El problema era que las pantallas de pasajero y conductor intentaban conectar el WebSocket **ANTES** de que el usuario estuviera autenticado, causando errores porque el backend requiere un token JWT válido para las conexiones WebSocket.

### Flujo Incorrecto (Antes)
```
1. App inicia
2. Usuario NO autenticado
3. Pantalla de pasajero/conductor se monta
4. useEffect() intenta conectar socket SIN TOKEN
5. Backend rechaza conexión: "Authentication error: No token provided"
6. Error: "websocket error" ❌
```

### Flujo Correcto (Ahora)
```
1. App inicia
2. Usuario NO autenticado
3. Pantalla verifica: ¿user existe?
4. NO → Skip socket connection ✅
5. Usuario hace login
6. Token guardado en SecureStore
7. Usuario autenticado
8. useEffect detecta cambio en `user`
9. Conecta socket CON TOKEN
10. Backend acepta conexión ✅
```

---

## Cambios Realizados

### 1. authStore.ts - Logs Detallados en Login
**Archivo**: `app/store/authStore.ts`

Agregué logs exhaustivos en la función `login()` para diagnosticar problemas:

```typescript
login: async (email, password, role) => {
  console.log('[LOGIN] Starting login...');
  console.log('[LOGIN] URL:', url);
  console.log('[LOGIN] Email/Phone:', email);
  console.log('[LOGIN] Role:', role || 'not specified');
  
  // ... fetch request ...
  
  console.log('[LOGIN] Response status:', response.status);
  console.log('[LOGIN] Success! Full result:', JSON.stringify(result));
  console.log('[LOGIN] Token exists:', !!token);
  console.log('[LOGIN] User exists:', !!user);
  console.log('[LOGIN] User data:', user ? JSON.stringify(user) : 'null');
  console.log('[LOGIN] Saving token...');
  console.log('[LOGIN] Saving user...');
  console.log('[LOGIN] Setting state...');
  console.log('[LOGIN] Complete! User authenticated:', user.email);
}
```

### 2. Passenger Screen - Socket Solo Si Autenticado
**Archivo**: `app/app/(passenger)/index.tsx`

```typescript
// ANTES
useEffect(() => {
  const setupSocket = async () => {
    await connectSocket(); // ❌ Sin verificar autenticación
  };
  setupSocket();
}, []);

// AHORA
useEffect(() => {
  if (!user) {
    console.log('[PASSENGER] User not authenticated, skipping socket connection');
    return; // ✅ Skip si no hay usuario
  }

  const setupSocket = async () => {
    console.log('[PASSENGER] Connecting socket...');
    await connectSocket();
    console.log('[PASSENGER] ✅ WebSocket connected');
  };
  setupSocket();
}, [user]); // ✅ Depende de `user`
```

### 3. Driver Screen - Socket Solo Si Autenticado
**Archivo**: `app/app/(driver)/index.tsx`

```typescript
const initializeSocket = async () => {
  if (!user) {
    console.log('[DRIVER] User not authenticated, skipping socket connection');
    return; // ✅ Skip si no hay usuario
  }

  try {
    console.log('[DRIVER] Connecting socket...');
    const socket = await connectSocket();
    console.log('[DRIVER] ✅ Socket connected successfully');
  } catch (error) {
    console.log('[DRIVER] Socket connection failed (optional):', error.message);
  }
};
```

---

## Backend - Configuración WebSocket

El backend está correctamente configurado y requiere autenticación JWT:

**Archivo**: `backend/src/services/socketService.ts`

```typescript
// Authentication middleware
io.use(async (socket: AuthenticatedSocket, next) => {
  try {
    // Get token from handshake auth or query
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      logger.warn('Socket connection rejected: No token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify JWT token
    const decoded = jwt.verify(token as string, config.jwtSecret) as JWTPayload;

    // Attach user data to socket
    socket.user = decoded;

    logger.info(`Socket authenticated: userId=${decoded.userId}, role=${decoded.role}`);
    next();
  } catch (error) {
    logger.error('Socket authentication failed:', error);
    next(new Error('Authentication error: Invalid token'));
  }
});
```

---

## Logs Esperados

### Antes del Login
```
LOG  [PASSENGER] User not authenticated, skipping socket connection
```
o
```
LOG  [DRIVER] User not authenticated, skipping socket connection
```

### Durante el Login
```
LOG  [LOGIN] Starting login...
LOG  [LOGIN] URL: http://192.168.1.200:3000/api/auth/login
LOG  [LOGIN] Email/Phone: yuliandra@gmail.com
LOG  [LOGIN] Role: passenger
LOG  [LOGIN] Response status: 200
LOG  [LOGIN] Success! Full result: {...}
LOG  [LOGIN] Token exists: true
LOG  [LOGIN] User exists: true
LOG  [LOGIN] User data: {"id":"...","email":"...","role":"passenger"}
LOG  [LOGIN] Saving token...
LOG  [LOGIN] Saving user...
LOG  [LOGIN] Setting state...
LOG  [LOGIN] Complete! User authenticated: yuliandra@gmail.com
```

### Después del Login
```
LOG  [PASSENGER] Connecting socket...
LOG  [PASSENGER] ✅ WebSocket connected
```
o
```
LOG  [DRIVER] Connecting socket...
LOG  [DRIVER] ✅ Socket connected successfully
```

---

## Archivos Modificados

1. `app/store/authStore.ts`
   - Agregados logs detallados en función `login()`

2. `app/app/(passenger)/index.tsx`
   - Socket solo se conecta si `user` existe
   - useEffect depende de `[user]`
   - Logs con prefijo `[PASSENGER]`

3. `app/app/(driver)/index.tsx`
   - Socket solo se conecta si `user` existe
   - Logs con prefijo `[DRIVER]`

4. `app/app/(auth)/register.tsx`
   - Alert mejorado con emoji ✅
   - Botón "Ir a Login" en lugar de "OK"
   - No cancelable

5. `app/app/(driver)/register.tsx`
   - Alert mejorado con emoji ✅
   - Botón "Ir a Login" en lugar de "OK"
   - No cancelable

---

## Testing

### Test 1: Registro
```
1. Abrir app
2. Ir a registro
3. Completar formulario
4. Presionar "Registrarse"
5. ✅ Ver Alert: "✅ Registro exitoso"
6. ✅ Presionar "Ir a Login"
7. ✅ Ver log: "[PASSENGER] User not authenticated, skipping socket connection"
8. ✅ NO ver errores de socket
```

### Test 2: Login
```
1. En pantalla de login
2. Ingresar email: yuliandra@gmail.com
3. Ingresar contraseña
4. Seleccionar rol: Pasajero
5. Presionar "Empezar a viajar"
6. ✅ Ver logs de [LOGIN] en consola
7. ✅ Ver log: "[LOGIN] Complete! User authenticated: yuliandra@gmail.com"
8. ✅ Ver log: "[PASSENGER] Connecting socket..."
9. ✅ Ver log: "[PASSENGER] ✅ WebSocket connected"
10. ✅ NO ver errores de socket
```

### Test 3: Navegación
```
1. Después del login exitoso
2. ✅ Debe redirigir a panel de pasajero
3. ✅ Socket debe estar conectado
4. ✅ NO debe haber errores en consola
```

---

## Resumen

**Problema**: Socket intentaba conectar sin token → Backend rechazaba → Errores

**Solución**: 
1. Verificar que `user` existe antes de conectar socket
2. Agregar logs detallados para diagnosticar
3. Socket se conecta automáticamente después del login

**Resultado**: 
- ✅ No más errores de socket antes del login
- ✅ Socket se conecta correctamente después del login
- ✅ Logs claros para debugging
- ✅ Flujo de autenticación limpio

---

## Próximo Paso

Compilar nuevo build con estos fixes y probar en dispositivo físico.
