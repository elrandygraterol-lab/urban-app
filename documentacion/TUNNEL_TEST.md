# Probar la App con Tunnel (localtunnel)

Para probar la app con dispositivos en cualquier red (datos móviles, otro WiFi).

## 1. Iniciar el tunnel

```bash
cd backend-urban-taxis
tunnel-start.bat
# O manualmente:
lt --port 3000 --subdomain urban-taxi-dev
```

Te dará una URL como: `https://urban-taxi-dev.loca.lt`

## 2. Iniciar backend con tunnel

```bash
cd backend-urban-taxis
set CORS_ALLOW_ALL=true
npm run dev
```

## 3. Configurar la app

Editar `C:\urban-taxis\app-urban-taxis\.env`:

```
EXPO_PUBLIC_API_URL=https://urban-taxi-dev.loca.lt
```

## 4. Reiniciar Metro

```bash
cd app-urban-taxis
npx expo start --clear
```

## 5. Escanear QR

Escanea el QR de Expo con cualquier dispositivo.
Sin importar la red, se conectará al backend a través del tunnel.

## Notas

- El WebSocket puede no funcionar con localtunnel (no lo soporta nativamente).
  Socket.io usará HTTP long-polling como fallback automático.
- Si ves errores 429 (rate limiting), espera unos segundos y reintenta.
- Para detener el tunnel: Ctrl+C en la ventana donde lo iniciaste.
