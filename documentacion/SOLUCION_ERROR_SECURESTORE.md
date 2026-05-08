# Solución: Error de SecureStore en Registro

## 🐛 Problema Identificado

### Error en la App
```
ERROR Registration error: [Error: Invalid value provided to SecureStore. 
Values must be strings; consider JSON-encoding your values if they are serializable.]
```

### Análisis de Logs

**Backend (✅ Funcionando)**:
```
LOG Response status: 201
LOG Registration successful
```
- El backend creó el usuario correctamente
- Status 201 = Created (exitoso)
- El usuario se guardó en la base de datos

**App (❌ Error)**:
```
ERROR Registration error: [Error: Invalid value provided to SecureStore...]
```
- El backend respondió correctamente
- El error ocurre al intentar guardar el token/usuario en SecureStore
- SecureStore solo acepta strings, pero está recibiendo otro tipo de dato

## 🔍 Causa Raíz

El backend está devolviendo la respuesta en un formato que no es el esperado. Posibles causas:

1. **Token no es string**: El backend puede estar devolviendo `token` como `null`, `undefined`, o un objeto
2. **Usuario no es objeto**: El backend puede estar devolviendo `user` en un formato incorrecto
3. **Estructura de respuesta diferente**: La respuesta puede tener una estructura diferente a `{ token, user }`

## ✅ Solución Implementada

He agregado validación y logs detallados en `app/store/authStore.ts`:

```typescript
const result = await response.json();
console.log('Registration successful');
console.log('Result:', result);  // ← Ver estructura completa

const { token, user } = result;

// Validar token
if (!token || typeof token !== 'string') {
  console.error('Invalid token received:', token);
  throw new Error('Invalid token received from server');
}

// Validar user
if (!user || typeof user !== 'object') {
  console.error('Invalid user received:', user);
  throw new Error('Invalid user data received from server');
}

// Guardar con logs
console.log('Saving token...');
await get().setToken(token);

console.log('Saving user...');
await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));

console.log('Setting state...');
set({ user, isAuthenticated: true });

console.log('Registration complete!');
```

## 🧪 Próximos Pasos

### 1. Probar el Registro Nuevamente

Recarga la app y vuelve a intentar registrarte. Los nuevos logs mostrarán:

```
LOG  Registration successful
LOG  Result: { ... }  ← Estructura completa de la respuesta
LOG  Saving token...
LOG  Saving user...
LOG  Setting state...
LOG  Registration complete!
```

O si hay error:

```
ERROR Invalid token received: null
```

### 2. Compartir los Nuevos Logs

Después de intentar registrarte, comparte los logs completos. Necesito ver:
- El contenido de `Result: { ... }`
- Si aparece algún error de validación

### 3. Posibles Escenarios

**Escenario A: Token es null/undefined**
```json
{
  "user": { ... },
  "token": null  ← Problema
}
```
**Solución**: Verificar configuración JWT en el backend

**Escenario B: Estructura diferente**
```json
{
  "data": {
    "user": { ... },
    "token": "..."
  }
}
```
**Solución**: Ajustar el código para extraer de `result.data`

**Escenario C: Token en otro campo**
```json
{
  "user": { ... },
  "accessToken": "..."  ← Nombre diferente
}
```
**Solución**: Cambiar `token` por `accessToken`

## 📧 Sobre el Error de Email

El error de email en el backend NO afecta el registro:

```
❌ Error sending email: Invalid login: 535-5.7.8 Username and Password not accepted
```

**Causa**: Credenciales de Gmail incorrectas o falta configurar "App Password"

**Impacto**: El usuario se crea correctamente, solo no recibe email de bienvenida

**Solución (Opcional)**:
1. Ir a Google Account → Security → 2-Step Verification
2. Crear "App Password" para la aplicación
3. Actualizar `SMTP_PASSWORD` en `backend/.env`

O simplemente deshabilitar el envío de emails en desarrollo.

## 🔧 Si el Problema Persiste

Si después de los nuevos logs el error continúa, necesitaré:

1. **Logs completos de la app** (especialmente el `Result: { ... }`)
2. **Código del backend** que genera la respuesta de registro
3. **Estructura exacta** de lo que el backend está devolviendo

## 📝 Comandos Útiles

**Recargar la app**:
```bash
# En la terminal de Expo
r
```

**Ver logs en tiempo real**:
```bash
# Backend
docker logs -f backend --tail 50

# App
# Ya están visibles en la terminal de Expo
```

## ✨ Resultado Esperado

Después de la corrección, deberías ver:

```
LOG  Registering at: http://192.168.1.200:3000/api/auth/register/passenger
LOG  Data: { ... }
LOG  Response status: 201
LOG  Registration successful
LOG  Result: { token: "eyJ...", user: { id: "...", ... } }
LOG  Saving token...
LOG  Saving user...
LOG  Setting state...
LOG  Registration complete!
```

Y el usuario debería quedar autenticado y navegar a la pantalla principal.
