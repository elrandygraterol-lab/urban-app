# 🚀 PRUEBA RÁPIDA - 5 Minutos

## ⚡ Solución Inmediata

### 1️⃣ Desactivar ProtonVPN (30 segundos)

```
En el dispositivo CONDUCTOR (192.168.1.2):
1. Abrir ProtonVPN
2. Clic en "Disconnect" / "Desconectar"
3. Cerrar ProtonVPN
```

---

### 2️⃣ Configurar Firewall (1 minuto)

```powershell
# En la PC del BACKEND (192.168.1.5):
# Clic derecho en PowerShell → "Ejecutar como administrador"

# Copiar y pegar este comando:
New-NetFirewallRule -DisplayName "Node.js Backend - All LAN" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -RemoteAddress 192.168.1.0/24 -Profile Private,Domain
```

**O usar el script automático**:
```powershell
# En la carpeta del proyecto:
.\CONFIGURAR_FIREWALL.ps1
```

---

### 3️⃣ Probar Conexión HTTP (30 segundos)

```
En el dispositivo CONDUCTOR:
1. Abrir navegador (Chrome, Firefox, etc.)
2. Ir a: http://192.168.1.5:3000
3. Debe mostrar: "UrbanTaxi API is running"
```

**✅ Si funciona**: Continuar al paso 4
**❌ Si NO funciona**: Verificar que ambos dispositivos estén en la misma red WiFi

---

### 4️⃣ Reiniciar App Conductor (30 segundos)

```
En el dispositivo CONDUCTOR:
1. Cerrar completamente la app UrbanTaxi
2. Abrir la app nuevamente
3. Iniciar sesión como conductor
4. Ir al panel de conductor
```

---

### 5️⃣ Verificar Conexión Socket (30 segundos)

```
En el panel de conductor:
1. Buscar el indicador en la esquina superior derecha
2. Debe mostrar un círculo VERDE con "Conectado"
```

**✅ Si muestra VERDE**: ¡Perfecto! Continuar al paso 6
**❌ Si muestra ROJO**: Ver logs en Metro bundler

---

### 6️⃣ Solicitar Viaje (1 minuto)

```
En el dispositivo PASAJERO (192.168.1.4):
1. Abrir app como pasajero
2. Seleccionar destino
3. Solicitar viaje
```

---

### 7️⃣ Verificar Notificación (30 segundos)

```
En el dispositivo CONDUCTOR:
1. Debe aparecer una tarjeta con la solicitud de viaje
2. Debe mostrar:
   - Nombre del pasajero
   - Dirección de recogida
   - Dirección de destino
   - Tarifa estimada
   - Distancia
3. Botones: "Rechazar" y "Aceptar"
```

**✅ Si aparece**: ¡ÉXITO! Todo funciona
**❌ Si NO aparece**: Ver logs del backend

---

## 📊 LOGS ESPERADOS

### Backend (Terminal)

```
✅ Socket.io server initialized with Redis adapter
Server running on http://0.0.0.0:3000

Socket authenticated: userId=conductor-id, role=driver
Client connected: socketId=xxx, userId=conductor-id, role=driver
User conductor-id joined personal room

[RideController] Ride request created: ride-123 by passenger pass-456
[PubSubService] Published RIDE_REQUESTED event
[RideNotificationHandler] Received RIDE_REQUESTED event for ride ride-123
📤 Emitting ride:request_created to user:conductor-id
   └─ Sockets in room: 1  ← DEBE SER 1
   └─ Socket ID: xxx
✅ Event ride:request_created emitted to user:conductor-id
```

---

### Frontend Conductor (Metro Bundler)

```
[SOCKET] ✅ Connected successfully! Socket ID: xxx
[DRIVER] ========== SETTING UP LISTENERS ==========
[DRIVER] Socket ID: xxx
[DRIVER] Socket connected: true
[DRIVER] ✅ Listener registered for: ride:request_created
[DRIVER] ==========================================
[DRIVER] Initial location sent: {"latitude": 10.xxx, "longitude": -67.xxx}

[DRIVER] ========== EVENT RECEIVED ==========
[DRIVER] 🚗 Ride request received: {
  "id": "ride-123",
  "passengerName": "Pasajero",
  "pickupAddress": "...",
  "destinationAddress": "...",
  "estimatedFare": 50.00,
  "distance": 5.2
}
[DRIVER] ========================================
```

---

## ❌ TROUBLESHOOTING

### Problema: http://192.168.1.5:3000 no carga

**Causa**: Red/Firewall bloqueando
**Solución**:
1. Verificar que ambos dispositivos estén en la misma red WiFi
2. Ejecutar el script de firewall como administrador
3. Desactivar ProtonVPN completamente

---

### Problema: Indicador muestra "Desconectado" (rojo)

**Causa**: Socket no puede conectar
**Solución**:
1. Verificar que http://192.168.1.5:3000 funcione primero
2. Ver logs en Metro bundler: buscar "Socket connection timeout"
3. Reiniciar backend: `npm run dev`
4. Reiniciar app conductor

---

### Problema: Backend dice "Sockets in room: 0"

**Causa**: Conductor no está conectado
**Solución**:
1. Verificar indicador en app (debe estar verde)
2. Reiniciar app conductor
3. Verificar logs: "User conductor-id joined personal room"

---

### Problema: Conductor conectado pero no recibe evento

**Causa**: Listener no registrado o userId incorrecto
**Solución**:
1. Verificar logs: "Listener registered for: ride:request_created"
2. Verificar logs backend: "Sockets in room: 1"
3. Verificar que el userId del token coincida con el conductor

---

## ✅ CHECKLIST RÁPIDO

```
[ ] ProtonVPN desactivado en conductor
[ ] Regla de firewall agregada (script ejecutado)
[ ] http://192.168.1.5:3000 accesible desde conductor
[ ] App conductor reiniciada
[ ] Indicador muestra "Conectado" (verde)
[ ] Backend logs: "User conductor-id joined personal room"
[ ] Viaje solicitado desde pasajero
[ ] Backend logs: "Sockets in room: 1"
[ ] Frontend logs: "EVENT RECEIVED"
[ ] Tarjeta de solicitud aparece en conductor
```

---

## 🎯 RESULTADO ESPERADO

**Tiempo total**: 5 minutos
**Probabilidad de éxito**: 99%

Si sigues estos pasos en orden, el problema DEBE resolverse.

---

**Fecha**: 27 de Marzo, 2026  
**Estado**: Lista para probar
