# 📋 Cómo Ver los Logs del Backend

## 🐳 Opción 1: Ver Logs de Todos los Servicios

```bash
cd backend
docker-compose logs -f
```

Esto muestra los logs de:
- ✅ Backend (Node.js)
- ✅ PostgreSQL
- ✅ Redis

El flag `-f` (follow) mantiene los logs actualizándose en tiempo real.

---

## 🎯 Opción 2: Ver Solo Logs del Backend

```bash
cd backend
docker-compose logs -f backend
```

Esto muestra **solo** los logs del servicio backend (Node.js).

---

## 📊 Opción 3: Ver Logs de un Servicio Específico

### Backend
```bash
docker-compose logs -f backend
```

### PostgreSQL
```bash
docker-compose logs -f postgres
```

### Redis
```bash
docker-compose logs -f redis
```

---

## 🔍 Opción 4: Ver Últimas N Líneas

```bash
# Ver últimas 100 líneas del backend
docker-compose logs --tail=100 backend

# Ver últimas 50 líneas de todos los servicios
docker-compose logs --tail=50
```

---

## ⏰ Opción 5: Ver Logs con Timestamps

```bash
docker-compose logs -f -t backend
```

El flag `-t` muestra la fecha y hora de cada log.

---

## 🔄 Opción 6: Ver Logs en Tiempo Real (Recomendado para Desarrollo)

```bash
cd backend
docker-compose logs -f --tail=50 backend
```

Esto:
1. Muestra las últimas 50 líneas
2. Sigue mostrando nuevos logs en tiempo real
3. Solo del servicio backend

---

## 🛠️ Opción 7: Usar Docker Desktop (Windows)

Si tienes Docker Desktop instalado:

1. Abre Docker Desktop
2. Ve a la pestaña "Containers"
3. Busca el contenedor `backend-backend-1` o similar
4. Haz clic en él
5. Ve a la pestaña "Logs"
6. Los logs se actualizan automáticamente

---

## 📝 Comandos Útiles Adicionales

### Ver estado de los contenedores
```bash
cd backend
docker-compose ps
```

### Ver logs sin seguir (solo una vez)
```bash
docker-compose logs backend
```

### Ver logs desde una fecha específica
```bash
docker-compose logs --since 2024-03-18T20:00:00 backend
```

### Ver logs hasta una fecha específica
```bash
docker-compose logs --until 2024-03-18T21:00:00 backend
```

### Buscar en los logs
```bash
docker-compose logs backend | grep "ERROR"
docker-compose logs backend | grep "Socket"
docker-compose logs backend | grep "POST"
```

---

## 🎨 Opción 8: Logs con Colores (Recomendado)

```bash
cd backend
docker-compose logs -f --tail=100 backend | cat
```

O instala `ccze` para logs con colores:

```bash
# En WSL/Linux
sudo apt-get install ccze
docker-compose logs -f backend | ccze -A
```

---

## 🚀 Comando Recomendado para Desarrollo

```bash
cd backend
docker-compose logs -f -t --tail=100 backend
```

Esto te da:
- ✅ Logs en tiempo real (`-f`)
- ✅ Con timestamps (`-t`)
- ✅ Últimas 100 líneas (`--tail=100`)
- ✅ Solo del backend

---

## 📱 Ver Logs Mientras Desarrollas la App

Abre **2 terminales**:

### Terminal 1: Backend Logs
```bash
cd backend
docker-compose logs -f backend
```

### Terminal 2: App Logs
```bash
cd app
npm run start:dev
```

Así puedes ver ambos logs al mismo tiempo.

---

## 🔧 Solución de Problemas

### Si no ves logs:

1. **Verifica que el backend esté corriendo**:
   ```bash
   docker-compose ps
   ```

2. **Si no está corriendo, inícialo**:
   ```bash
   docker-compose up -d
   ```

3. **Luego ve los logs**:
   ```bash
   docker-compose logs -f backend
   ```

### Si los logs están vacíos:

```bash
# Reinicia el backend
docker-compose restart backend

# Ve los logs
docker-compose logs -f backend
```

---

## 📊 Ejemplo de Logs que Deberías Ver

```
backend-1  | [2024-03-18 20:30:15] INFO: Server starting...
backend-1  | [2024-03-18 20:30:16] INFO: Database connected
backend-1  | [2024-03-18 20:30:16] INFO: Redis connected
backend-1  | [2024-03-18 20:30:17] INFO: Server listening on port 3000
backend-1  | [2024-03-18 20:30:20] GET /api/health 200 5ms
backend-1  | [2024-03-18 20:30:25] POST /api/auth/login 200 150ms
```

---

## 🎯 Atajos Rápidos

Crea estos alias en tu `.bashrc` o `.bash_profile`:

```bash
# Agregar al final de ~/.bashrc
alias backend-logs='cd ~/OneDrive/Desktop/app-taxis/backend && docker-compose logs -f backend'
alias backend-status='cd ~/OneDrive/Desktop/app-taxis/backend && docker-compose ps'
alias backend-restart='cd ~/OneDrive/Desktop/app-taxis/backend && docker-compose restart backend'
```

Luego solo ejecuta:
```bash
backend-logs
```

---

## 📝 Resumen de Comandos

| Comando | Descripción |
|---------|-------------|
| `docker-compose logs -f backend` | Logs en tiempo real del backend |
| `docker-compose logs --tail=100 backend` | Últimas 100 líneas |
| `docker-compose logs -t backend` | Con timestamps |
| `docker-compose logs backend \| grep ERROR` | Buscar errores |
| `docker-compose ps` | Ver estado de servicios |
| `docker-compose restart backend` | Reiniciar backend |

---

**Comando más usado para desarrollo:**

```bash
cd backend && docker-compose logs -f --tail=100 backend
```
