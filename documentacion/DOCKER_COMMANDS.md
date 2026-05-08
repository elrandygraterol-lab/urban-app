# Comandos Docker para UrbanTaxi Backend

## Configuración Actualizada

El backend ahora usa un **profile** de Docker Compose, lo que significa que NO se iniciará automáticamente con `docker-compose up -d`.

## Comandos Disponibles

### 1. Iniciar solo servicios base (PostgreSQL, Redis)
```bash
docker-compose up -d
```
Este comando inicia:
- ✅ PostgreSQL (puerto 5433)
- ✅ Redis (puerto 6379)
- ❌ Backend (NO se inicia)

### 2. Iniciar backend con Docker (opcional)
```bash
docker-compose --profile backend up -d
```
Este comando inicia:
- ✅ PostgreSQL (puerto 5433)
- ✅ Redis (puerto 6379)
- ✅ Backend (puerto 3000)

### 3. Iniciar backend en modo desarrollo (recomendado)
```bash
npm run dev
```
Este comando:
- ✅ Usa los servicios de Docker (PostgreSQL, Redis)
- ✅ Ejecuta el backend con hot-reload
- ✅ Permite debugging fácil

### 4. Detener todos los servicios
```bash
docker-compose down
```

### 5. Detener solo el backend (si está corriendo con Docker)
```bash
docker-compose --profile backend down
```

### 6. Ver logs del backend (si está corriendo con Docker)
```bash
docker-compose logs -f backend
```

### 7. Iniciar servicios de monitoreo (opcional)
```bash
docker-compose --profile monitoring up -d
```
Este comando inicia:
- ✅ Prometheus (puerto 9090)
- ✅ Grafana (puerto 3001)
- ✅ AlertManager (puerto 9093)

## Flujo de Trabajo Recomendado para Desarrollo

1. **Iniciar servicios base:**
   ```bash
   cd backend
   docker-compose up -d
   ```

2. **Verificar que los servicios estén corriendo:**
   ```bash
   docker-compose ps
   ```

3. **Ejecutar el backend en modo desarrollo:**
   ```bash
   npm run dev
   ```

4. **Acceder al panel de admin:**
   - Abrir navegador en: http://localhost:3000/admin
   - Usar credenciales de admin (ver prisma/seed.ts)

## Panel de Administración

### Acceso
- **URL:** http://localhost:3000/admin
- **Credenciales por defecto:**
  - Email: `admin@urbantaxi.com`
  - Password: `Admin123!`

### Rutas disponibles:
- `/admin` - Redirige a login o dashboard
- `/admin/login` - Login de admin (EJS)
- `/admin/dashboard` - Dashboard principal (EJS)
- `/admin/users` - Gestión de usuarios (EJS)
- `/admin/drivers` - Gestión de conductores (EJS)
- `/admin/verifications` - Verificaciones pendientes (EJS)
- `/admin/rides` - Viajes en vivo (EJS)
- `/admin/fares` - Configuración de tarifas (EJS)
- `/admin/reports` - Reportes y exportación (EJS)

### Tecnología
- **Motor de vistas:** EJS (Embedded JavaScript Templates)
- **Autenticación:** JWT con cookies httpOnly
- **Layout:** Bootstrap 5 con diseño responsive

## Puertos Utilizados

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| Backend API | 3000 | API REST y WebSocket |
| PostgreSQL | 5433 | Base de datos (mapeado desde 5432) |
| Redis | 6379 | Caché y pub/sub |
| OSRM | 5000 | Servicio de rutas (WSL2) |
| Prometheus | 9090 | Métricas (opcional) |
| Grafana | 3001 | Dashboards (opcional) |
| AlertManager | 9093 | Alertas (opcional) |

## Notas Importantes

1. **PostgreSQL en Docker usa puerto 5433** (no 5432) para evitar conflictos con instalaciones locales
2. **OSRM corre en WSL2** en el puerto 5000, no en Docker
3. **El backend en desarrollo** usa `npm run dev` y se conecta a los servicios de Docker
4. **Los servicios de monitoreo** son opcionales y se inician con `--profile monitoring`

## Troubleshooting

### El backend no se conecta a PostgreSQL
```bash
# Verificar que PostgreSQL esté corriendo
docker-compose ps postgres

# Ver logs de PostgreSQL
docker-compose logs postgres

# Verificar la conexión
docker-compose exec postgres psql -U urbantaxi -d urbantaxi -c "SELECT 1;"
```

### El backend no se conecta a Redis
```bash
# Verificar que Redis esté corriendo
docker-compose ps redis

# Ver logs de Redis
docker-compose logs redis

# Probar conexión
docker-compose exec redis redis-cli ping
```

### Reiniciar todos los servicios
```bash
docker-compose down
docker-compose up -d
npm run dev
```
