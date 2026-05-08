# ✅ Solución: Error de Socket "Cannot read property 'on' of undefined"

## 🔴 Error Encontrado

```
ERROR [TypeError: Cannot read property 'on' of undefined]
setupSocketListeners (app\(driver)\index.tsx)
```

## 🔍 Causa del Problema

En `app/(driver)/index.tsx` estabas importando `socket` directamente:

```typescript
import { socket } from '@/services/socket';  // ❌ INCORRECTO
```

Pero en `services/socket.ts`, la variable `socket` es **privada** y no se exporta:

```typescript
let socket: Socket | null = null;  // Variable privada, no exportada
```

Cuando intentabas usar `socket.on()`, el valor era `undefined` porque nunca se inicializó la conexión.

## ✅ Solución Aplicada

He actualizado `app/(driver)/index.tsx` para:

1. **Importar las funciones correctas**:
   ```typescript
   import { connectSocket, getSocket, disconnectSocket } from '@/services/socket';
   ```

2. **Inicializar el socket correctamente**:
   ```typescript
   const initializeSocket = async () => {
     try {
       const socket = await connectSocket();  // Conectar primero
       setSocketInstance(socket);
       setupSocketListeners(socket);  // Luego configurar listeners
     } catch (error) {
       console.error('Failed to connect socket:', error);
     }
   };
   ```

3. **Usar `getSocket()` cuando necesites el socket**:
   ```typescript
   const socket = getSocket();
   if (socket) {
     socket.emit('driver:location_update', { ... });
   }
   ```

4. **Limpiar correctamente al desmontar**:
   ```typescript
   return () => {
     const socket = getSocket();
     if (socket) {
       socket.off('ride:request_created');
     }
     disconnectSocket();
   };
   ```

## 📊 Cambios Realizados

| Antes (❌ Incorrecto) | Después (✅ Correcto) |
|----------------------|----------------------|
| `import { socket }` | `import { connectSocket, getSocket }` |
| `socket.on(...)` directamente | `await connectSocket()` primero |
| `socket.emit(...)` sin verificar | `const socket = getSocket(); if (socket) { ... }` |
| No se inicializaba la conexión | `initializeSocket()` en useEffect |

## 🎯 Resultado

Ahora el socket:
1. ✅ Se conecta correctamente al iniciar
2. ✅ Se verifica antes de usar
3. ✅ Se limpia correctamente al desmontar
4. ✅ No causa errores si falla la conexión

## 🚀 Próximo Paso

Recarga la app para ver los cambios:

```bash
# En la terminal donde está corriendo npm run start:dev
# Presiona 'r' para recargar
```

O en la app:
- Agita el dispositivo
- Selecciona "Reload"

## 📝 Nota Importante

El socket es **opcional** para el funcionamiento básico de la app. Si el backend no está corriendo o hay problemas de conexión, la app seguirá funcionando pero sin actualizaciones en tiempo real.

Para que el socket funcione completamente, necesitas:
1. ✅ Backend corriendo en `http://192.168.1.200:3000`
2. ✅ Usuario autenticado (token guardado)
3. ✅ Conexión de red estable

## ✅ Verificación

Después de recargar, deberías ver en los logs:

```
✅ Socket connected: [socket_id]
```

Si ves esto, el socket está funcionando correctamente.

Si ves errores de conexión, verifica que el backend esté corriendo.
