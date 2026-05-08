# OSRM en AlmaLinux VPS - Guía Completa

## ✅ Respuesta Rápida

**SÍ, funcionará en tu VPS con AlmaLinux sin cambios en el código.** Solo necesitas instalar OSRM una vez en el servidor.

## 🚀 Instalación Automática

```bash
# En tu VPS AlmaLinux
cd backend
npm run osrm:setup
```

Este script instalará y configurará todo automáticamente.

---

## 📋 Instalación Manual (Paso a Paso)

### 1. Instalar Dependencias

```bash
# Habilitar repositorio EPEL
sudo dnf install -y epel-release

# Instalar herramientas de desarrollo
sudo dnf groupinstall -y "Development Tools"

# Instalar dependencias de OSRM
sudo dnf install -y cmake boost-devel bzip2-devel libxml2-devel \
  libzip-devel lua-devel tbb-devel wget git
```

### 2. Compilar OSRM

```bash
# Clonar repositorio
cd /tmp
git clone https://github.com/Project-OSRM/osrm-backend.git
cd osrm-backend

# Compilar (10-15 minutos)
mkdir -p build
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build .
sudo cmake --build . --target install
```

### 3. Configurar Directorio de Datos

```bash
# Crear directorio
sudo mkdir -p /opt/osrm-data
sudo chown $USER:$USER /opt/osrm-data
cd /opt/osrm-data
```

### 4. Descargar y Procesar Datos de Venezuela

```bash
# Descargar datos (~107MB)
wget https://download.geofabrik.de/south-america/venezuela-latest.osm.pbf

# Copiar perfil de routing
cp /tmp/osrm-backend/profiles/car.lua .

# Procesar datos (5-10 minutos)
osrm-extract -p car.lua venezuela-latest.osm.pbf
osrm-partition venezuela-latest.osrm
osrm-customize venezuela-latest.osrm
```

### 5. Configurar Servicio Systemd (Recomendado)

```bash
# Crear archivo de servicio
sudo nano /etc/systemd/system/osrm.service
```

Contenido del archivo:

```ini
[Unit]
Description=OSRM Routing Service
After=network.target

[Service]
Type=simple
User=tu-usuario
WorkingDirectory=/opt/osrm-data
ExecStart=/usr/local/bin/osrm-routed --algorithm mld /opt/osrm-data/venezuela-latest.osrm --port 5000 --ip 0.0.0.0
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Recargar systemd
sudo systemctl daemon-reload

# Habilitar inicio automático
sudo systemctl enable osrm

# Iniciar servicio
sudo systemctl start osrm

# Verificar estado
sudo systemctl status osrm
```

---

## 🎯 Uso en Producción

### Iniciar OSRM

```bash
# Opción 1: Con systemd (recomendado)
sudo systemctl start osrm

# Opción 2: Con npm
npm run osrm:start

# Opción 3: Manual
cd /opt/osrm-data
osrm-routed --algorithm mld venezuela-latest.osrm --port 5000 --ip 0.0.0.0 &
```

### Detener OSRM

```bash
# Opción 1: Con systemd
sudo systemctl stop osrm

# Opción 2: Con npm
npm run osrm:stop
```

### Ver Estado

```bash
# Con systemd
sudo systemctl status osrm

# Con npm
npm run osrm:status

# Verificar endpoint
curl http://localhost:5000/status
```

### Ver Logs

```bash
# Con systemd
sudo journalctl -u osrm -f

# Logs del sistema
tail -f /var/log/messages | grep osrm
```

---

## 🔧 Configuración del Backend

### Variables de Entorno

En tu VPS, el archivo `.env` ya está configurado correctamente:

```bash
OSRM_URL=http://localhost:5000
```

**No necesitas cambiar nada.** El backend se conectará automáticamente a OSRM en localhost.

### Docker Compose

El `docker-compose.yml` ya está configurado para usar OSRM del host:

```yaml
environment:
  OSRM_URL: http://host.docker.internal:5000
```

En Linux, `host.docker.internal` apunta automáticamente al host.

---

## 🔥 Firewall (Importante)

Si usas firewalld en AlmaLinux:

```bash
# Permitir puerto 5000 solo desde localhost (más seguro)
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="127.0.0.1" port protocol="tcp" port="5000" accept'

# O permitir desde la red Docker
sudo firewall-cmd --permanent --zone=trusted --add-source=172.17.0.0/16

# Recargar firewall
sudo firewall-cmd --reload
```

**Nota:** No expongas el puerto 5000 públicamente. Solo el backend debe acceder a OSRM.

---

## 📊 Monitoreo

### Verificar que OSRM está corriendo

```bash
# Verificar proceso
ps aux | grep osrm-routed

# Verificar puerto
sudo netstat -tulpn | grep 5000

# Probar endpoint
curl "http://localhost:5000/route/v1/driving/-66.9036,10.4806;-66.8792,10.5089?overview=false"
```

### Recursos del Sistema

```bash
# Ver uso de memoria
free -h

# Ver uso de CPU
top -p $(pgrep osrm-routed)
```

OSRM típicamente usa:
- **RAM**: 500MB - 1GB (para datos de Venezuela)
- **CPU**: Bajo en reposo, picos durante cálculos de rutas

---

## 🔄 Actualizar Datos de Mapas

```bash
# Detener OSRM
sudo systemctl stop osrm

# Descargar nuevos datos
cd /opt/osrm-data
mv venezuela-latest.osm.pbf venezuela-latest.osm.pbf.old
wget https://download.geofabrik.de/south-america/venezuela-latest.osm.pbf

# Reprocesar
rm -f venezuela-latest.osrm*
osrm-extract -p car.lua venezuela-latest.osm.pbf
osrm-partition venezuela-latest.osrm
osrm-customize venezuela-latest.osrm

# Reiniciar OSRM
sudo systemctl start osrm
```

---

## 🚨 Troubleshooting

### OSRM no inicia

```bash
# Verificar logs
sudo journalctl -u osrm -n 50

# Verificar que los archivos existen
ls -lh /opt/osrm-data/venezuela-latest.osrm*

# Verificar permisos
sudo chown -R $USER:$USER /opt/osrm-data
```

### Backend no puede conectarse

```bash
# Verificar que OSRM está escuchando
sudo netstat -tulpn | grep 5000

# Debe mostrar: 0.0.0.0:5000

# Probar desde el host
curl http://localhost:5000/status

# Probar desde Docker
docker exec urbantaxi-backend curl http://host.docker.internal:5000/status
```

### Puerto 5000 ocupado

```bash
# Ver qué está usando el puerto
sudo lsof -i :5000

# Cambiar puerto en el servicio
sudo nano /etc/systemd/system/osrm.service
# Cambiar --port 5000 a --port 5001

# Actualizar .env
OSRM_URL=http://localhost:5001

# Reiniciar
sudo systemctl daemon-reload
sudo systemctl restart osrm
```

### Memoria insuficiente

Si tu VPS tiene poca RAM:

```bash
# Crear swap (2GB)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Hacer permanente
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 🎯 Inicio Automático en Boot

Con systemd (ya configurado):

```bash
# Verificar que está habilitado
sudo systemctl is-enabled osrm

# Si no está habilitado
sudo systemctl enable osrm
```

OSRM se iniciará automáticamente cuando reinicies el servidor.

---

## 📦 Despliegue Completo

### Script de Despliegue

```bash
#!/bin/bash
# deploy.sh

# Detener servicios
sudo systemctl stop osrm
docker-compose down

# Actualizar código
git pull

# Instalar dependencias
npm install

# Iniciar OSRM
sudo systemctl start osrm

# Esperar a que OSRM inicie
sleep 5

# Iniciar servicios Docker
docker-compose up -d --build

echo "✅ Despliegue completado"
```

---

## 🔐 Seguridad

1. **No expongas OSRM públicamente**: Solo debe ser accesible desde localhost
2. **Usa firewall**: Bloquea el puerto 5000 desde internet
3. **Actualiza regularmente**: Mantén OSRM y las dependencias actualizadas
4. **Monitorea recursos**: Configura alertas para uso de CPU/RAM

---

## 📚 Recursos

- [OSRM Documentation](http://project-osrm.org/)
- [AlmaLinux Documentation](https://wiki.almalinux.org/)
- [Systemd Service Management](https://www.freedesktop.org/software/systemd/man/systemd.service.html)

---

## ✅ Checklist de Producción

- [ ] OSRM instalado y compilado
- [ ] Datos de Venezuela procesados
- [ ] Servicio systemd configurado
- [ ] Inicio automático habilitado
- [ ] Firewall configurado
- [ ] Backend puede conectarse a OSRM
- [ ] Monitoreo configurado
- [ ] Backup de datos configurado
