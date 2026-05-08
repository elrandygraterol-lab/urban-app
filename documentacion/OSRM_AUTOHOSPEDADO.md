# OSRM Autohospedado - Configuración Completada

## ✅ Configuración Realizada

### 1. Docker Compose
- **Archivo**: `docker-compose.osrm.yml`
- **Imagen**: `osrm/osrm-backend:v5.27.1`
- **Puerto**: 5000
- **Algoritmo**: MLD (Multi-Level Dijkstra)
- **Health Check**: Automático cada 30 segundos

### 2. Scripts de Setup

#### Windows (PowerShell)
```powershell
cd backend
.\scripts\setup-osrm.ps1 -Region argentina
```

#### Linux/Mac (Bash)
```bash
cd backend
chmod +x scripts/setup-osrm.sh
./scripts/setup-osrm.sh argentina
```

**El script automáticamente:**
1. Descarga datos de OpenStreetMap
2. Extrae datos OSRM (osrm-extract)
3. Particiona datos (osrm-partition)
4. Personaliza datos (osrm-customize)

### 3. Configuración de Entorno

**Archivo**: `backend/.env`
```
OSRM_URL=http://localhost:5000
```

**Para Producción:**
```
OSRM_URL=http://your-vps-ip:5000
```

### 4. Documentación

- `backend/OSRM_SETUP.md` - Guía completa de setup
- `backend/INFRASTRUCTURE_SETUP.md` - Documentación de infraestructura
- `backend/.env.osrm.example` - Ejemplo de configuración

## 🚀 Quick Start (5 minutos)

### Paso 1: Preparar datos OSM
```bash
cd backend
.\scripts\setup-osrm.ps1 -Region argentina
```

### Paso 2: Iniciar OSRM
```bash
docker-compose -f docker-compose.osrm.yml up -d
```

### Paso 3: Verificar
```bash
curl http://localhost:5000/status
```

### Paso 4: Probar ruta
```bash
curl 'http://localhost:5000/route/v1/driving/-74.0060,40.7128;-73.9855,40.7580?overview=full'
```

## 📊 Costos

### Autohospedado
- VPS (2GB RAM, 2 CPU): $5-15/mes
- Storage (20GB SSD): $0-5/mes
- Bandwidth: $0-10/mes
- **Total**: $5-30/mes

### vs Google Maps
- Google Maps: $100-200+/mes (variable)
- **Ahorro**: 75-90%

## 🔧 Regiones Soportadas

Descarga desde Geofabrik: https://download.geofabrik.de/

### América del Sur
- Argentina
- Brazil
- Colombia
- Peru
- Chile
- Venezuela

### América Central
- Mexico
- Guatemala
- Costa Rica

### Otros
- Europa, Asia, Africa, América del Norte

## 📝 Comandos Útiles

### Verificar estado
```bash
curl http://localhost:5000/status
```

### Ver logs
```bash
docker-compose -f docker-compose.osrm.yml logs -f osrm
```

### Reiniciar OSRM
```bash
docker-compose -f docker-compose.osrm.yml restart osrm
```

### Detener OSRM
```bash
docker-compose -f docker-compose.osrm.yml down
```

### Ver uso de recursos
```bash
docker stats osrm
```

## 🌐 Endpoints OSRM

Una vez ejecutándose, OSRM proporciona:

- **Routing**: `/route/v1/driving/{lon1},{lat1};{lon2},{lat2}`
- **Distance Matrix**: `/table/v1/driving/{coordinates}`
- **Nearest**: `/nearest/v1/driving/{lon},{lat}`
- **Matching**: `/match/v1/driving/{coordinates}`
- **Trip**: `/trip/v1/driving/{coordinates}`

## 🔐 Seguridad

### Firewall (Producción)
```bash
# Permitir puerto 5000
sudo ufw allow 5000/tcp

# O restringir a servidor backend
sudo ufw allow from <backend-ip> to any port 5000
```

### Nginx Reverse Proxy (Recomendado)
```nginx
server {
    listen 80;
    server_name osrm.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_cache_valid 200 1h;
        proxy_cache_key "$scheme$request_method$host$request_uri";
    }
}
```

## 📈 Optimización

### Caché
- TTL: 1 hora
- Max rutas en caché: 1000
- Habilitado por defecto

### Load Balancing
Para alto tráfico, ejecutar múltiples instancias:
```yaml
osrm-1: puerto 5000
osrm-2: puerto 5001
osrm-3: puerto 5002
```

## 🐛 Troubleshooting

### OSRM no responde
```bash
docker-compose -f docker-compose.osrm.yml logs osrm
docker-compose -f docker-compose.osrm.yml restart osrm
```

### Alto uso de memoria
- Usar región más pequeña
- Aumentar RAM del VPS
- Usar perfil diferente (foot en lugar de car)

### Puerto en uso
```bash
lsof -i :5000
kill -9 <PID>
```

## 📚 Recursos

- OSRM Docs: https://project-osrm.org/docs/v5.27.1/api/
- Geofabrik: https://download.geofabrik.de/
- Docker: https://docs.docker.com/
- OpenStreetMap: https://www.openstreetmap.org/

## ✅ Checklist de Implementación

- [x] Docker Compose configurado
- [x] Scripts de setup creados (Windows + Linux/Mac)
- [x] Documentación completa
- [x] Configuración de entorno actualizada
- [x] Ejemplos de configuración
- [ ] OSRM ejecutándose localmente (próximo paso)
- [ ] Datos OSM descargados (próximo paso)
- [ ] Verificación de conectividad (próximo paso)

## 🎯 Próximos Pasos

1. Ejecutar script de setup: `.\scripts\setup-osrm.ps1 -Region argentina`
2. Iniciar OSRM: `docker-compose -f docker-compose.osrm.yml up -d`
3. Verificar: `curl http://localhost:5000/status`
4. Configurar Mapbox API key
5. Continuar con Phase 5: Frontend Implementation

---

**Estado**: ✅ Listo para desplegar
**Última actualización**: 2026-03-15
