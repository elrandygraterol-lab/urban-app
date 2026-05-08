# ✅ Solución: Error "Network request failed"

## 🔴 Error Encontrado

```
ERROR Registration error: [TypeError: Network request failed]
```

## 🔍 Causa del Problema

La app estaba configurada para conectarse a `http://localhost:3000`, pero:

1. **`localhost` en un dispositivo físico** se refiere al dispositivo mismo, no a tu computadora
2. El backend está corriendo en tu computadora en `192.168.1.200:3000`
3. La app no puede alcanzar el backend porque está buscando en el lugar equivocado

## ✅ Solución Aplicada

He actualizado `app/.env` para usar tu IP de red local:

### Antes (❌ Incorrecto)
```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### Después (✅ Correcto)
```env
EXPO_PUBLIC_API_URL=http://192.168.1.200:3000
```

## 🚀 Próximo Paso: Reiniciar el Servidor de Desarrollo

**IMPORTANTE**: Debes reiniciar el servidor de Expo para que cargue el nuevo `.env`:

### Opción 1: Reiniciar Completamente (Recomendado)

```bash
# En la terminal donde está corriendo npm run start:dev
# Presiona Ctrl+C para detener

# Luego inicia de nuevo
npm run start:dev
```

### Opción 2: Limpiar Cache y Reiniciar

```bash
# Detener con Ctrl+C

# Limpiar cache
npx expo start --clear

# O con el script
npm run start:dev
```

## 📱 Después de Reiniciar

1. **Recarga la app** en tu dispositivo:
   - Agita el dispositivo
   - Selecciona "Reload"

2. **Intenta registrarte de nuevo**

3. **Deberías ver**:
   - ✅ La petición se envía al backend
   - ✅ El backend responde (éxito o error, pero responde)
   - ❌ Ya no verás "Network request failed"

## 🔍 Verificación del Backend

El backend está corriendo correctamente en:
- ✅ IP: `192.168.1.200`
- ✅ Puerto: `3000`
- ✅ Estado: Running (pero unhealthy por healthcheck)
- ✅ Accesible desde la red local

Puedes verificarlo desde tu navegador:
```
http://192.168.1.200:3000/
```

Deberías ver un error JSON (eso es normal, significa que el backend está respondiendo).

## 📊 Logs Esperados

### En la App (Después de reiniciar)
```
✓ App cargada
✓ Conectando a http://192.168.1.200:3000
✓ POST /api/auth/register
```

### En el Backend
```bash
# Para ver los logs del backend:
cd backend
docker-compose logs -f backend
```

Deberías ver las peticiones llegando:
```
[http]: Incoming request [req:xxx] {"method":"POST","url":"/api/auth/register"}
```

## 🛠️ Solución de Problemas

### Si sigue sin funcionar:

1. **Verifica que reiniciaste el servidor de Expo**:
   ```bash
   # Debe decir: env: export EXPO_PUBLIC_API_URL
   # Con la nueva URL
   ```

2. **Verifica que el backend esté corriendo**:
   ```bash
   cd backend
   docker-compose ps
   ```

3. **Verifica que tu dispositivo esté en la misma red WiFi**:
   - Tu computadora: Red WiFi `[nombre]`
   - Tu dispositivo: Debe estar en la **misma red**

4. **Verifica el firewall de Windows**:
   ```powershell
   # Permitir conexiones en el puerto 3000
   netsh advfirewall firewall add rule name="Backend Port 3000" dir=in action=allow protocol=TCP localport=3000
   ```

5. **Prueba desde el navegador del dispositivo**:
   - Abre el navegador en tu teléfono
   - Ve a: `http://192.168.1.200:3000/`
   - Deberías ver un error JSON (eso es bueno)

## 📝 Notas Importantes

### Para Desarrollo Local
- ✅ Usa `http://192.168.1.200:3000`
- ✅ Funciona con dispositivos físicos
- ✅ Funciona con emuladores en la misma red

### Para Producción
- Cambiarás esto a tu dominio real
- Ejemplo: `https://api.urbantaxi.com`

### Si tu IP cambia
Si tu computadora obtiene una IP diferente (después de reiniciar el router, etc.):

1. Obtén la nueva IP:
   ```bash
   ipconfig | Select-String -Pattern "IPv4"
   ```

2. Actualiza `app/.env`:
   ```env
   EXPO_PUBLIC_API_URL=http://[NUEVA_IP]:3000
   ```

3. Reinicia el servidor de Expo

## ✅ Resumen de Cambios

| Archivo | Cambio |
|---------|--------|
| `app/.env` | `localhost:3000` → `192.168.1.200:3000` |

## 🎯 Próxima Acción

```bash
# 1. Detener el servidor de Expo (Ctrl+C)
# 2. Reiniciar
cd app
npm run start:dev

# 3. Recargar la app en el dispositivo
# 4. Intentar registrarse de nuevo
```

**El error "Network request failed" debería desaparecer.**
