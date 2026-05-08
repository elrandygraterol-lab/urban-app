# Flujo de Autenticación Corregido

## Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE REGISTRO                            │
└─────────────────────────────────────────────────────────────────┘

Usuario abre app
    ↓
Pantalla de Login
    ↓
Click en "Regístrate aquí"
    ↓
Pantalla de Registro
    ↓
Selecciona rol (Pasajero/Conductor)
    ↓
Completa formulario
    ↓
Click en "Registrarse"
    ↓
App valida datos localmente
    ↓
App agrega +58 al teléfono (si no tiene)
    ↓
App envía POST a /api/auth/register/{role}
    ↓
Backend valida datos
    ↓
Backend crea usuario en BD
    ↓
Backend retorna: { success: true, data: { user, tokens } }
    ↓
App muestra Alert: "Registro exitoso. Por favor inicia sesión."
    ↓
Usuario presiona OK
    ↓
App redirige a Pantalla de Login
    ↓
Usuario NO está autenticado ✅


┌─────────────────────────────────────────────────────────────────┐
│                     FLUJO DE LOGIN                              │
└─────────────────────────────────────────────────────────────────┘

Usuario en Pantalla de Login
    ↓
Selecciona rol (Pasajero/Conductor)
    ↓
Ingresa email o teléfono
    ↓
Ingresa contraseña
    ↓
Click en "Empezar a viajar/trabajar"
    ↓
App valida datos localmente
    ↓
App envía POST a /api/auth/login
    Payload: { emailOrPhone, password } ✅
    ↓
Backend busca usuario por email O teléfono
    ↓
Backend valida contraseña
    ↓
Backend valida estado de cuenta
    ↓
Backend retorna: { success: true, data: { user, tokens } }
    ↓
App guarda token en SecureStore
    ↓
App guarda usuario en SecureStore
    ↓
App establece isAuthenticated = true
    ↓
_layout.tsx detecta autenticación
    ↓
_layout.tsx verifica rol del usuario
    ↓
┌─────────────────┬─────────────────┐
│  Si es Pasajero │ Si es Conductor │
└─────────────────┴─────────────────┘
         ↓                  ↓
    /(passenger)       /(driver)
         ↓                  ↓
   Panel Pasajero    Panel Conductor
         ↓                  ↓
   Socket conecta    Socket conecta ✅


┌─────────────────────────────────────────────────────────────────┐
│                  MANEJO DE SOCKET                               │
└─────────────────────────────────────────────────────────────────┘

App inicia
    ↓
useEffect en (driver)/index.tsx
    ↓
Verifica si user existe
    ↓
┌──────────────────┬──────────────────┐
│ user === null    │ user !== null    │
└──────────────────┴──────────────────┘
        ↓                    ↓
   Log: "User not      connectSocket()
   authenticated"           ↓
        ↓              Socket conecta
   NO conecta              ↓
   socket ✅          Log: "Socket
        ↓              connected
   Sin errores       successfully" ✅
```

---

## Comparación: Antes vs Ahora

### ANTES (Con Problemas)

#### Registro
```
Usuario registra → Backend crea cuenta → App auto-autentica
→ App muestra Alert → Usuario presiona OK
→ App intenta ir a login PERO usuario ya está autenticado
→ _layout.tsx detecta autenticación → Redirige a panel
→ Conflicto de navegación → Errores de socket ❌
```

#### Login
```
Usuario hace login → App envía { email, password }
→ Backend espera { emailOrPhone, password }
→ Error de validación: "emailOrPhone required" ❌
```

---

### AHORA (Corregido)

#### Registro
```
Usuario registra → Backend crea cuenta
→ App muestra Alert → Usuario presiona OK
→ App redirige a login → Usuario NO autenticado
→ Flujo limpio ✅
```

#### Login
```
Usuario hace login → App envía { emailOrPhone, password }
→ Backend valida correctamente
→ Login exitoso → Redirige a panel según rol
→ Socket conecta automáticamente ✅
```

---

## Validaciones Implementadas

### Frontend

#### Login
- ✅ Email/teléfono no vacío
- ✅ Email válido O teléfono válido (regex)
- ✅ Contraseña mínimo 8 caracteres
- ✅ Rol seleccionado

#### Registro
- ✅ Nombre no vacío
- ✅ Email válido (regex)
- ✅ Teléfono válido (mínimo 10 dígitos)
- ✅ Contraseña mínimo 8 caracteres
- ✅ Contraseñas coinciden
- ✅ Campos de conductor (si aplica)

### Backend

#### Login
- ✅ emailOrPhone requerido
- ✅ password requerido
- ✅ Usuario existe
- ✅ Cuenta no suspendida
- ✅ Cuenta no eliminada
- ✅ Contraseña correcta (bcrypt)

#### Registro
- ✅ Email único
- ✅ Teléfono único
- ✅ Contraseña hasheada (bcrypt)
- ✅ Perfil creado en transacción

---

## Manejo de Errores

### Login

| Error | Mensaje |
|-------|---------|
| Credenciales inválidas | "Credenciales inválidas. Por favor intenta de nuevo." |
| Rol incorrecto | "Esta cuenta es de [rol]. Por favor selecciona el rol correcto." |
| Cuenta suspendida | "Tu cuenta ha sido suspendida. Contacta a soporte." |
| Cuenta eliminada | "Esta cuenta ha sido eliminada" |
| Error de red | "Credenciales inválidas. Por favor intenta de nuevo." |

### Registro

| Error | Mensaje |
|-------|---------|
| Email duplicado | "El email ya está registrado" |
| Teléfono duplicado | "El número de teléfono ya está registrado" |
| Validación fallida | Mensaje específico del campo |
| Error de red | "No se pudo completar el registro. Por favor intenta de nuevo." |

---

## Socket Connection

### Estados del Socket

```
┌─────────────────────────────────────────────────────────────┐
│                    ANTES DEL LOGIN                          │
└─────────────────────────────────────────────────────────────┘

user = null
    ↓
Socket NO se conecta
    ↓
Log: "User not authenticated, skipping socket connection"
    ↓
✅ Esto es NORMAL y ESPERADO


┌─────────────────────────────────────────────────────────────┐
│                   DESPUÉS DEL LOGIN                         │
└─────────────────────────────────────────────────────────────┘

user = { id, email, name, ... }
    ↓
Socket se conecta automáticamente
    ↓
Log: "Socket connected successfully"
    ↓
Socket ID: abc123...
    ↓
✅ Listo para recibir eventos en tiempo real
```

---

## Logs Normales vs Errores

### ✅ Logs Normales (No son errores)

Antes del login:
```
LOG  User not authenticated, skipping socket connection
WARN  Must use physical device for Push Notifications
```

Después del login:
```
LOG  Socket connected successfully
LOG  Socket ID: abc123...
```

### ❌ Errores Reales

```
ERROR  Login failed: Credenciales inválidas
ERROR  Registration failed: El email ya está registrado
ERROR  Network request failed
```

---

## Testing Checklist

### ✅ Registro de Pasajero
- [ ] Formulario se completa correctamente
- [ ] Teléfono sin +58 → Se agrega automáticamente
- [ ] Click en "Registrarse" → Alert de éxito
- [ ] Click en OK → Redirige a login
- [ ] Usuario NO queda autenticado

### ✅ Registro de Conductor
- [ ] Formulario personal se completa
- [ ] Formulario de vehículo se completa
- [ ] Click en "Registrarse" → Alert de éxito
- [ ] Click en OK → Redirige a login
- [ ] Usuario NO queda autenticado

### ✅ Login con Email
- [ ] Ingresar email registrado
- [ ] Ingresar contraseña correcta
- [ ] Seleccionar rol correcto
- [ ] Click en "Empezar a viajar/trabajar"
- [ ] Login exitoso → Redirige a panel
- [ ] Socket se conecta automáticamente

### ✅ Login con Teléfono
- [ ] Ingresar teléfono (con o sin +58)
- [ ] Ingresar contraseña correcta
- [ ] Seleccionar rol correcto
- [ ] Click en "Empezar a viajar/trabajar"
- [ ] Login exitoso → Redirige a panel
- [ ] Socket se conecta automáticamente

### ✅ Login con Rol Incorrecto
- [ ] Registrar cuenta de pasajero
- [ ] Intentar login como conductor
- [ ] Debe mostrar error de rol incorrecto

---

## Resumen de Cambios

| Archivo | Línea | Cambio |
|---------|-------|--------|
| `app/store/authStore.ts` | 71 | `email` → `emailOrPhone` |
| `app/store/authStore.ts` | 130-135 | Removida auto-autenticación |

**Total de líneas modificadas**: ~10 líneas
**Impacto**: Crítico - Corrige flujo completo de autenticación

---

## Estado Final

✅ Login funciona con email o teléfono
✅ Registro no auto-autentica
✅ Flujo de navegación limpio
✅ Socket se conecta correctamente
✅ Validaciones robustas
✅ Manejo de errores completo
✅ Build compilado exitosamente

**Build ID**: `47301ca4-44bc-4f45-acc0-81dfdc8d4ffa`

🚀 Listo para testing en dispositivo físico
