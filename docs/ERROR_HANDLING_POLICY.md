# Política de Manejo de Errores

## Principio General

**Los errores técnicos NO deben mostrarse a los usuarios finales (pasajeros y conductores).**

Los errores técnicos solo deben registrarse en la consola/terminal para debugging por parte de los desarrolladores.

## Clasificación de Errores

### ❌ Errores Técnicos (NO mostrar al usuario)

Estos errores se registran en consola con `console.error()` y `logError()`:

1. **Errores de Red**
   - Timeout de conexión
   - Fallo de API
   - Error de socket
   - Ejemplo: `"TransformError SyntaxError: C:\Users\..."`

2. **Errores de Ubicación**
   - No se pudo obtener ubicación
   - GPS no disponible
   - Permisos denegados (se maneja silenciosamente)

3. **Errores de Geocoding**
   - No se pudo buscar dirección
   - API de mapas falló

4. **Errores de Estado**
   - No se pudo actualizar estado del viaje
   - Error al cargar detalles

5. **Errores de Llamadas/Mapas**
   - No se pudo abrir aplicación de mapas
   - No se pudo realizar llamada

### ✅ Errores de Negocio (SÍ mostrar al usuario)

Estos errores se muestran con mensajes amigables:

1. **Validaciones de Formulario**
   - "Por favor ingresa una dirección de destino"
   - "Por favor selecciona una valoración"
   - "Debes iniciar sesión para solicitar un viaje"

2. **Errores de Disponibilidad**
   - "No hay conductores disponibles" (404)
   - "Número de teléfono no disponible"

3. **Errores de Pago**
   - "No se pudo completar el pago" (con mensaje del backend si está disponible)

4. **Errores de Cancelación**
   - "No se pudo cancelar" (con mensaje del backend si está disponible)

5. **Errores de Valoración**
   - "No se pudo enviar" (con mensaje del backend si está disponible)

6. **Sesión Expirada**
   - "Tu sesión ha expirado. Por favor, inicia sesión nuevamente."

## Implementación

### Para Errores Técnicos

```typescript
try {
  // Operación que puede fallar
  await someOperation();
} catch (error) {
  // Log en consola para desarrolladores
  console.error('Operation failed:', error);
  logError('ComponentName', error, { context: 'Operation description' });

  // NO mostrar al usuario
  // ❌ Alert.alert('Error', 'Failed to...')
  // ❌ addNotification({ type: 'error', ... })
}
```

### Para Errores de Negocio

```typescript
try {
  // Operación que puede fallar
  await someBusinessOperation();
} catch (error) {
  // Log en consola
  console.error('Business operation failed:', error);
  logError('ComponentName', error, { context: 'Business operation' });

  // Mostrar mensaje amigable al usuario
  const userMessage = error.response?.data?.error?.message
    ? error.response.data.error.message
    : 'No se pudo completar la operación. Por favor intenta nuevamente.';

  Alert.alert('No se pudo completar', userMessage);
}
```

## Ejemplos de Cambios Realizados

### ❌ Antes (Incorrecto)

```typescript
catch (error) {
  Alert.alert('Error', 'Failed to get location');
}
```

### ✅ Después (Correcto)

```typescript
catch (error) {
  console.error('Failed to get location:', error);
  logError('DriverHomeScreen', error, { context: 'Getting location' });
  // No se muestra nada al usuario
}
```

### ❌ Antes (Incorrecto)

```typescript
catch (error) {
  Alert.alert('Error', error.response?.data?.error?.message || 'Failed');
}
```

### ✅ Después (Correcto)

```typescript
catch (error) {
  console.error('Payment failed:', error);
  logError('PassengerHomeScreen', error, { context: 'Process payment' });

  const userMessage = error.response?.data?.error?.message
    ? error.response.data.error.message
    : 'No se pudo procesar el pago. Por favor intenta nuevamente.';

  Alert.alert('No se pudo completar el pago', userMessage);
}
```

## Archivos Modificados

1. `app/app/(passenger)/index.tsx`
   - Eliminados errores técnicos de ubicación
   - Eliminados errores técnicos de geocoding
   - Mejorados mensajes de errores de negocio

2. `app/app/(driver)/index.tsx`
   - Eliminados errores técnicos de ubicación
   - Eliminados errores técnicos de aceptar viaje

3. `app/app/(driver)/active-ride.tsx`
   - Eliminados errores técnicos de cargar detalles
   - Eliminados errores técnicos de actualizar estado
   - Eliminados errores técnicos de abrir mapas
   - Eliminados errores técnicos de realizar llamadas

## Beneficios

1. **Mejor Experiencia de Usuario**
   - No se confunden con mensajes técnicos
   - Solo ven información relevante y accionable

2. **Debugging Más Fácil**
   - Todos los errores técnicos están en la consola
   - Logs estructurados con contexto

3. **Profesionalismo**
   - La app se ve más pulida y profesional
   - Mensajes claros y en español

4. **Seguridad**
   - No se exponen detalles técnicos de la implementación
   - No se muestran rutas de archivos o stack traces

## Regla de Oro

**Si el usuario no puede hacer nada para resolver el error, no se lo muestres.**

Solo muestra errores cuando:

- El usuario cometió un error (validación)
- El usuario necesita tomar una acción (reintentar, iniciar sesión)
- El usuario necesita saber que algo no está disponible (sin conductores)
