# 🚨 PRUEBA INMEDIATA - Conexión del Conductor

## ⚡ HACER AHORA (2 minutos)

### Paso 1: Probar HTTP desde el Conductor

En el dispositivo conductor (192.168.1.2):

1. Abrir navegador (Chrome, Firefox, cualquiera)
2. Ir a: `http://192.168.1.5:3000`

**¿Qué ves?**

- [ ] A) "UrbanTaxi API is running" ✅
- [ ] B) "No se puede acceder al sitio" / "Connection refused" ❌
- [ ] C) Se queda cargando infinitamente ❌
- [ ] D) Otro mensaje: __________________

---

### Paso 2: Verificar Red WiFi

**En el conductor:**
- ¿Está conectado a la misma red WiFi que el backend?
- Nombre de la red WiFi: __________________

**En el backend (laptop):**
- ¿Está conectado a la misma red WiFi?
- Nombre de la red WiFi: __________________

---

### Paso 3: Verificar IP del Backend

**En el backend (laptop), ejecutar:**

```bash
ipconfig
```

Buscar la sección "Adaptador de LAN inalámbrica Wi-Fi" o "Wireless LAN adapter Wi-Fi"

**¿Cuál es la IPv4?**
- IP actual: __________________
- ¿Es 192.168.1.5? [ ] Sí [ ] No

---

## 📊 RESULTADOS ESPERADOS

### Si el navegador NO carga (Paso 1 = B o C):

**Problema**: El conductor no puede alcanzar el backend por red

**Causas posibles**:
1. Están en redes WiFi diferentes
2. Firewall de Windows bloqueando
3. IP del backend cambió
4. Router bloqueando comunicación entre dispositivos

**Solución**:
1. Verificar que ambos estén en la MISMA red WiFi
2. Ejecutar script de firewall: `.\CONFIGURAR_FIREWALL.ps1`
3. Verificar IP del backend con `ipconfig`

---

### Si el navegador SÍ carga (Paso 1 = A):

**Problema**: HTTP funciona pero WebSocket no

**Causas posibles**:
1. Firewall bloqueando WebSocket específicamente
2. Router bloqueando protocolo WebSocket
3. Problema con Socket.io en el dispositivo

**Solución**:
1. Probar con `transports: ['polling']` en lugar de websocket
2. Verificar configuración del router
3. Reiniciar app conductor

---

## 🔧 SOLUCIONES RÁPIDAS

### Solución 1: Ambos en la misma red WiFi

```
1. Backend (laptop): Conectar a WiFi "NombreRed"
2. Conductor (teléfono): Conectar a WiFi "NombreRed"
3. Reiniciar app conductor
```

---

### Solución 2: Configurar Firewall

```powershell
# En PowerShell como Administrador:
.\CONFIGURAR_FIREWALL.ps1
```

---

### Solución 3: Verificar IP y actualizar .env

Si la IP del backend cambió:

```bash
# En backend, ejecutar:
ipconfig

# Buscar IPv4, ejemplo: 192.168.1.10
```

Luego actualizar `app/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
```

Y reiniciar Metro bundler:

```bash
cd app
npx expo start --clear
```

---

## ⏱️ TIEMPO ESTIMADO

- Paso 1: 30 segundos
- Paso 2: 30 segundos
- Paso 3: 1 minuto

**Total: 2 minutos**

---

## 📞 REPORTAR RESULTADOS

Por favor reporta:

1. ¿El navegador carga `http://192.168.1.5:3000`? [ ] Sí [ ] No
2. ¿Ambos dispositivos en la misma WiFi? [ ] Sí [ ] No
3. ¿IP del backend es 192.168.1.5? [ ] Sí [ ] No

Con esta información sabré EXACTAMENTE cuál es el problema.
