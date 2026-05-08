# Migración de OSRM: De Docker a WSL2

## ✅ Cambios Realizados

### 1. Docker Compose
- ❌ Eliminado servicio `osrm` de `docker-compose.yml`
- ✅ Backend ahora apunta a `http://host.docker.internal:5000` (OSRM en host)
- ✅ Eliminada dependencia de OSRM en el backend
- ✅ Eliminado volumen `osrm_data`

### 2. Archivos Eliminados/Obsoletos
- `osrm.Dockerfile` - Ya no se necesita
- `osrm-config/taxi.lua` - Puedes copiarlo a WSL2 si quieres usarlo

### 3. Nuevos Archivos
- ✅ `OSRM_WINDOWS_SETUP.md` - Guía completa de instalación
- ✅ `start-dev.ps1` - Script PowerShell para iniciar todo
- ✅ `start-osrm.sh` - Script bash para iniciar OSRM en WSL2

### 4. Configuración
- ✅ `.env` actualizado con `OSRM_URL=http://localhost:5000`
- ✅ `OSRM_README.md` actualizado con nuevas instrucciones

## 🚀 Próximos Pasos

### Paso 1: Instalar WSL2 (si no lo tienes)
```powershell
# En PowerShell como Administrador
wsl --install
```

Reinicia tu computadora después de la instalación.

### Paso 2: Instalar OSRM en WSL2
Sigue la guía completa en `OSRM_WINDOWS_SETUP.md`

Resumen rápido:
```bash
# En WSL2 Ubuntu
sudo apt-get update
sudo apt-get install -y build-essential git cmake pkg-config \
  libbz2-dev libxml2-dev libzip-dev libboost-all-dev \
  lua5.2 liblua5.2-dev libtbb-dev

# Clonar y compilar OSRM
cd ~
git clone https://github.com/Project-OSRM/osrm-backend.git
cd osrm-backend
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build .
sudo cmake --build . --target install
```

### Paso 3: Descargar y Procesar Datos
```bash
# En WSL2
mkdir -p ~/osrm-data
cd ~/osrm-data

# Descargar datos de Venezuela
wget https://download.geofabrik.de/south-america/venezuela-latest.osm.pbf

# Procesar datos (5-10 minutos)
cp ~/osrm-backend/profiles/car.lua ~/osrm-data/
osrm-extract -p car.lua venezuela-latest.osm.pbf
osrm-partition venezuela-latest.osrm
osrm-customize venezuela-latest.osrm
```

### Paso 4: Copiar Script de Inicio
```bash
# En WSL2
# Copia el contenido de backend/start-osrm.sh a ~/osrm-data/start-osrm.sh
chmod +x ~/osrm-data/start-osrm.sh
```

### Paso 5: Iniciar Todo
```powershell
# En PowerShell (desde el directorio backend)
.\start-dev.ps1
```

O manualmente:
```powershell
# Terminal 1: Iniciar OSRM
wsl ~/osrm-data/start-osrm.sh

# Terminal 2: Iniciar servicios Docker
cd backend
docker-compose up
```

## 🔍 Verificación

### Verificar OSRM
```powershell
# Verificar estado
Invoke-WebRequest -Uri "http://localhost:5000/status"

# Probar routing
Invoke-WebRequest -Uri "http://localhost:5000/route/v1/driving/-66.9036,10.4806;-66.8792,10.5089?overview=false"
```

### Verificar Backend
```powershell
# Verificar que el backend puede conectarse a OSRM
Invoke-WebRequest -Uri "http://localhost:3000/api/health"
```

## 🎯 Ventajas de Este Cambio

1. ✅ **Sin problemas de Docker**: No más errores de imagen OSRM antigua
2. ✅ **Más rápido**: OSRM corre nativamente en WSL2
3. ✅ **Más control**: Puedes actualizar OSRM fácilmente
4. ✅ **Menos recursos**: Un contenedor menos en Docker
5. ✅ **Mejor debugging**: Logs más accesibles

## 🐛 Troubleshooting

### OSRM no inicia
```bash
# Verificar instalación
wsl which osrm-routed

# Verificar datos
wsl ls -lh ~/osrm-data/
```

### Backend no puede conectarse
- Verifica que OSRM está corriendo: `curl http://localhost:5000/status`
- Verifica que el puerto 5000 no está bloqueado por firewall
- Verifica que `OSRM_URL` en `.env` es correcto

### Puerto 5000 ocupado
```bash
# Cambiar puerto en start-osrm.sh
osrm-routed --algorithm mld venezuela-latest.osrm --port 5001 --ip 0.0.0.0

# Actualizar .env
OSRM_URL=http://localhost:5001
```

## 📚 Recursos

- [OSRM Documentation](http://project-osrm.org/)
- [WSL2 Documentation](https://docs.microsoft.com/en-us/windows/wsl/)
- [OSRM GitHub](https://github.com/Project-OSRM/osrm-backend)
