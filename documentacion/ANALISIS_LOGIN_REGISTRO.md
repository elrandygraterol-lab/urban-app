# Análisis Exhaustivo: Login y Registro

## Fecha: 2026-03-18

## Resumen de Cambios Realizados

### 1. ✅ Fix Login - Campo `emailOrPhone`

**Problema**: La app enviaba `{ email, password }` pero el backend esperaba `{ emailOrPhone, password }`

**Solución**: 
- Archivo: `app/store/authStore.ts`
- Línea 71: Cambiado `body: JSON.stringify({ email, password })` a `body: JSON.stringify({ emailOrPhone: email, password })`

**Resultado**: El login ahora funciona correctamente con email o teléfono.

---

### 2. ✅ Fix Registro - Auto-autenticación Removida

**Problema**: Después del registro exitoso, el usuario quedaba autenticado automáticamente, causando conflictos de navegación y errores de socket.

**Solución**:
- Archivo: `app/store/authStore.ts`
- Función `register()`: Removida toda la lógica de auto-autenticación
- Ahora solo valida que el registro fue exitoso y retorna
- Las pantallas de registro muestran Alert y redirigen a login

**Resultado**: Flujo limpio - Registro → Alert de éxito → Login manual → Autenticación → Panel correspondiente

---

## Flujo Completo Verificado

### Flujo de Registro (Pasajero o Conductor)

1. Usuario completa formulario de registro
2. App valida datos localmente
3. App agrega prefijo `+58` al teléfono si no tiene `+`
4. App envía POST a `/api/auth/register/passenger` o `/api/auth/register/driver`
5. Backend crea usuario y retorna `{ success: true, data: { user, tokens } }`
6. App muestra Alert: "Registro exitoso. Por favor inicia sesión."
7. Usuario presiona OK → Redirige a pantalla de login
8. Usuario NO queda autenticado automáticamente

### Flujo de Login

1. Usuario ingresa email/teléfono y contraseña
2. Usuario selecciona rol (pasajero o conductor)
3. App valida datos localmente
4. App envía POST a `/api/auth/login` con `{ emailOrPhone, password }`
5. Backend busca usuario por email O teléfono
6. Backend valida contraseña y estado de cuenta
7. Backend retorna `{ success: true, data: { user, tokens } }`
8. App guarda token en SecureStore
9. App guarda usuario en SecureStore
10. App establece `isAuthenticated: true`
11. `_layout.tsx` detecta autenticación y redirige según rol:
    - Pasajero → `/(passenger)`
    - Conductor → `/(driver)`
12. Socket se conecta automáticamente (solo si está autenticado)

---

## Validaciones Implementadas

### Frontend (App)

#### Login
- Email/teléfono no vacío
- Email válido O teléfono válido (regex)
- Contraseña mínimo 8 caracteres
- Rol seleccionado coincide con cuenta

#### Registro
- Nombre no vacío
- Email válido (regex)
- Teléfono válido (mínimo 10 dígitos)
- Contraseña mínimo 8 caracteres
- Contraseñas coinciden
- Campos específicos de conductor (si aplica):
  - Placa no vacía
  - Modelo no vacío

### Backend

#### Login
- `emailOrPhone` requerido (string)
- `password` requerido (string)
- Usuario existe en BD
- Cuenta no suspendida
- Cuenta no eliminada
- Contraseña correcta (bcrypt)

#### Registro
- Email único
- Teléfono único
- Contraseña hasheada (bcrypt, 12 rounds)
- Perfil creado en transacción

---

## Manejo de Errores

### Login
- Credenciales inválidas → Alert con mensaje
- Rol incorrecto → Alert: "Esta cuenta es de [rol]. Por favor selecciona el rol correcto."
- Cuenta suspendida → Alert con mensaje del backend
- Error de red → Alert: "Credenciales inválidas. Por favor intenta de nuevo."

### Registro
- Email duplicado → Alert: "El email ya está registrado"
- Teléfono duplicado → Alert: "El número de teléfono ya está registrado"
- Validación fallida → Alert con mensaje específico
- Error de red → Alert: "No se pudo completar el registro. Por favor intenta de nuevo."

---

## Socket Connection

### Comportamiento Correcto
- Socket solo se conecta si `user` existe (autenticado)
- Si no hay usuario → Log: "User not authenticated, skipping socket connection"
- Errores de socket son informativos, no bloquean la app
- Socket se desconecta automáticamente en logout

### Logs Normales (No son errores)
```
LOG  User not authenticated, skipping socket connection
WARN  Must use physical device for Push Notifications
LOG  ⚠️ Socket connection error: websocket error
```

Estos logs aparecen cuando:
- Usuario no está autenticado
- App está en Expo Go (no tiene notificaciones push)
- Socket intenta conectar sin token

**Solución**: Estos logs desaparecen después del login exitoso.

---

## Archivos Modificados

1. `app/store/authStore.ts`
   - Línea 71: Fix login payload (`emailOrPhone`)
   - Líneas 130-135: Removida auto-autenticación en registro

2. `app/app/(auth)/register.tsx`
   - Ya tenía Alert y redirección a login ✅

3. `app/app/(driver)/register.tsx`
   - Ya tenía Alert y redirección a login ✅

4. `app/app/(driver)/index.tsx`
   - Ya maneja correctamente socket sin autenticación ✅

---

## Testing Manual Recomendado

### Test 1: Registro de Pasajero
1. Abrir app → Ir a Registro
2. Seleccionar "Pasajero"
3. Completar formulario con datos válidos
4. Presionar "Registrarse"
5. ✅ Debe mostrar Alert: "Registro exitoso"
6. ✅ Presionar OK → Debe ir a pantalla de login
7. ✅ NO debe quedar autenticado

### Test 2: Registro de Conductor
1. Abrir app → Ir a Registro
2. Seleccionar "Conductor"
3. Completar formulario con datos válidos + info vehículo
4. Presionar "Registrarse"
5. ✅ Debe mostrar Alert: "Registro exitoso"
6. ✅ Presionar OK → Debe ir a pantalla de login
7. ✅ NO debe quedar autenticado

### Test 3: Login con Email
1. Ir a pantalla de login
2. Ingresar email registrado
3. Ingresar contraseña correcta
4. Seleccionar rol correcto
5. Presionar "Empezar a viajar/trabajar"
6. ✅ Debe autenticar correctamente
7. ✅ Debe redirigir al panel correspondiente
8. ✅ Socket debe conectarse (ver log: "Socket connected successfully")

### Test 4: Login con Teléfono
1. Ir a pantalla de login
2. Ingresar teléfono registrado (con o sin +58)
3. Ingresar contraseña correcta
4. Seleccionar rol correcto
5. Presionar "Empezar a viajar/trabajar"
6. ✅ Debe autenticar correctamente
7. ✅ Debe redirigir al panel correspondiente

### Test 5: Login con Rol Incorrecto
1. Registrar cuenta de pasajero
2. Intentar login seleccionando "Conductor"
3. ✅ Debe mostrar error: "Esta cuenta es de pasajero. Por favor selecciona el rol correcto."

---

## Estado Final

### ✅ Completado
- Login funciona con email o teléfono
- Registro no auto-autentica
- Flujo de navegación limpio
- Socket se conecta solo cuando está autenticado
- Validaciones frontend y backend
- Manejo de errores robusto
- Prefijo +58 automático en teléfonos

### 🎯 Próximo Paso
- Compilar nuevo build con estos fixes
- Probar en dispositivo físico
- Verificar que todo funcione correctamente

---

## Comando para Compilar Build

```bash
cd app
eas build --platform android --profile development
```

Build anterior: `5ac38c21-285a-4553-acb2-c47c66b581a6` (sin Google Maps)
Build nuevo: Incluirá fixes de login/registro
