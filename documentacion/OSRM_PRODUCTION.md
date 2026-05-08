# OSRM en Producción - Guía Completa

## 🎯 Opciones para Mantener OSRM en Segundo Plano

### Opción 1: systemd (Recomendado) ⭐

**Ventajas:**
- ✅ Nativo de Linux, sin dependencias extra
- ✅ Inicio automático al reiniciar el servidor
- ✅ Logs integrados con journalctl
- ✅ Máxima estabilidad y confiabilidad
- ✅ Gestión de recursos del sistema
- ✅ Usado por la mayoría de servicios del sistema

**Comandos:**
```bash
# Iniciar
sudo systemctl start osrm

# Detener
sudo systemctl stop osrm

# Reiniciar
sudo systemctl restart osrm

# Ver estado
sudo systemctl status osrm

# Ver logs
sudo journalctl -u osrm -f

# Habilitar inicio automático
sudo systemctl enable osrm
```

**Configuración:** Ya está incluida en `npm run osrm:setup`

---

### Opción 2: PM2 (Alternativa Popular) 🚀

**Ventajas:**
- ✅ Interfaz visual con `pm2 monit`
- ✅ Fácil de usar si ya conoces PM2
- ✅ Clustering para aplicaciones Node.js
- ✅ Dashboard web opcional (PM2 Plus)
- ✅ Gestión desde npm scripts

**Comandos:**
```bash
# Instalar PM2
sudo npm install -g pm2

# Iniciar OSRM
npm run osrm:pm2:start
# O: pm2 start ecosystem.config.js --only osrm

# Ver estado
npm run osrm:pm2:status
# O: pm2 status

# Ver logs
npm run osrm:pm2:logs
# O: pm2 logs osrm

# Reiniciar
npm run osrm:pm2:restart
# O: pm2 restart osrm

# Detener
npm run osrm:pm2:stop
# O: pm2 stop osrm

# Inicio automático
pm2 save
pm2 startup
```

**Configuración:** Ver `ecosystem.config.js` y `PM2_SETUP.md`

---

### Opción 3: nohup (Simple pero Básico)

**Ventajas:**
- ✅ No requiere instalación
- ✅ Muy simple

**Desventajas:**
- ❌ No reinicia automáticamente si falla
- ❌ No inicia automáticamente al reiniciar
- ❌ Gestión manual de logs

**Comandos:**
```bash
# Iniciar
nohup osrm-routed --algorithm mld /opt/osrm-data/venezuela-latest.osrm --port 5000 --ip 0.0.0.0 > /var/log/osrm.log 2>&1 &

# Ver PID
echo $!

# Detener
kill <PID>

# Ver logs
tail -f /var/log/osrm.log
```

---

## 📊 Comparación

| Característica | systemd | PM2 | nohup |
|----------------|---------|-----|-------|
| Inicio automático | ✅ | ✅ | ❌ |
| Reinicio en fallo | ✅ | ✅ | ❌ |
| Gestión de logs | ✅ | ✅ | ⚠️ |
| Monitoreo visual | ❌ | ✅ | ❌ |
| Clustering | ❌ | ✅ | ❌ |
| Nativo Linux | ✅ | ❌ | ✅ |
| Fácil de usar | ⚠️ | ✅ | ✅ |
| Recursos | Bajo | Medio | Bajo |

---

## 🎯 Recomendación por Caso de Uso

### Usa systemd si:
- Es tu primer VPS o servidor de producción
- Quieres la solución más estable y confiable
- No necesitas características avanzadas
- Prefieres herramientas nativas del sistema
- **Recomendado para la mayoría de casos** ⭐

### Usa PM2 si:
- Ya usas PM2 para otras aplicaciones Node.js
- Quieres monitoreo visual con `pm2 monit`
- Necesitas clustering para el backend
- Te gusta la interfaz de PM2
- Quieres dashboard web (PM2 Plus)

### Usa nohup si:
- Solo necesitas algo temporal
- Estás probando en desarrollo
- No te importa el reinicio automático
- **No recomendado para producción**

---

## 🚀 Setup Recomendado para Producción

### Configuración Inicial (Una sola vez)

```bash
# 1. Instalar OSRM
npm run osrm:setup

# 2. Elegir tu método preferido:

# Opción A: systemd (Recomendado)
sudo systemctl enable osrm
sudo systemctl start osrm

# Opción B: PM2
sudo npm install -g pm2
pm2 start ecosystem.config.js --only osrm
pm2 save
pm2 startup
```

### Verificación

```bash
# systemd
sudo systemctl status osrm
curl http://localhost:5000/

# PM2
pm2 status
curl http://localhost:5000/
```

### Monitoreo

```bash
# systemd
sudo journalctl -u osrm -f

# PM2
pm2 logs osrm
pm2 monit
```

---

## 🔧 Configuración de Recursos

### Limitar Memoria (systemd)

Editar `/etc/systemd/system/osrm.service`:

```ini
[Service]
MemoryLimit=1G
MemoryMax=1.5G
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart osrm
```

### Limitar Memoria (PM2)

En `ecosystem.config.js`:

```javascript
{
  max_memory_restart: '1G'
}
```

---

## 📊 Monitoreo de Recursos

### Ver uso de memoria y CPU

```bash
# systemd
systemctl status osrm

# PM2
pm2 monit

# General
top -p $(pgrep osrm-routed)
htop -p $(pgrep osrm-routed)
```

---

## 🔄 Actualizar Datos de Mapas

```bash
# 1. Detener OSRM
sudo systemctl stop osrm  # o: pm2 stop osrm

# 2. Actualizar datos
cd /opt/osrm-data
wget -O venezuela-latest.osm.pbf https://download.geofabrik.de/south-america/venezuela-latest.osm.pbf
rm -f venezuela-latest.osrm*
osrm-extract -p car.lua venezuela-latest.osm.pbf
osrm-partition venezuela-latest.osrm
osrm-customize venezuela-latest.osrm

# 3. Reiniciar OSRM
sudo systemctl start osrm  # o: pm2 start osrm
```

---

## 🐛 Troubleshooting

### OSRM no inicia

```bash
# systemd
sudo journalctl -u osrm -n 50
sudo systemctl status osrm

# PM2
pm2 logs osrm --err
pm2 describe osrm
```

### Puerto ocupado

```bash
# Ver qué está usando el puerto 5000
sudo lsof -i :5000
sudo netstat -tulpn | grep 5000

# Detener proceso
sudo systemctl stop osrm  # o: pm2 stop osrm
```

### Memoria insuficiente

```bash
# Crear swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 📚 Recursos

- [systemd Documentation](https://www.freedesktop.org/software/systemd/man/)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [OSRM Documentation](http://project-osrm.org/)
- [AlmaLinux Documentation](https://wiki.almalinux.org/)
