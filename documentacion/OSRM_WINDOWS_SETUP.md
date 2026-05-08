# Instalación de OSRM en Windows (Sin Docker)

## Opción 1: Usar OSRM Pre-compilado con WSL2 (Recomendado)

### Paso 1: Instalar WSL2
```powershell
# En PowerShell como Administrador
wsl --install
```

### Paso 2: Instalar Ubuntu en WSL2
```powershell
wsl --install -d Ubuntu
```

### Paso 3: Instalar OSRM en Ubuntu (WSL2)
```bash
# Dentro de WSL2 Ubuntu
sudo apt-get update
sudo apt-get install -y build-essential git cmake pkg-config \
  libbz2-dev libxml2-dev libzip-dev libboost-all-dev \
  lua5.2 liblua5.2-dev libtbb-dev

# Clonar OSRM
cd ~
git clone https://github.com/Project-OSRM/osrm-backend.git
cd osrm-backend

# Compilar OSRM
mkdir -p build
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build .
sudo cmake --build . --target install
```

### Paso 4: Descargar y Procesar Datos de Venezuela
```bash
# Crear directorio para datos
mkdir -p ~/osrm-data
cd ~/osrm-data

# Descargar datos de Venezuela (~107MB)
wget https://download.geofabrik.de/south-america/venezuela-latest.osm.pbf

# Copiar perfil de taxi desde tu proyecto
# Desde Windows, copia el archivo a WSL:
# En PowerShell:
# wsl cp /mnt/c/Users/TU_USUARIO/ruta/al/proyecto/backend/osrm-config/taxi.lua ~/osrm-data/

# O usa el perfil por defecto de coche
cp ~/osrm-backend/profiles/car.lua ~/osrm-data/

# Procesar datos (esto puede tomar 5-10 minutos)
osrm-extract -p ~/osrm-data/car.lua ~/osrm-data/venezuela-latest.osm.pbf
osrm-partition ~/osrm-data/venezuela-latest.osrm
osrm-customize ~/osrm-data/venezuela-latest.osrm
```

### Paso 5: Iniciar Servidor OSRM
```bash
# Iniciar servidor en puerto 5000
osrm-routed --algorithm mld ~/osrm-data/venezuela-latest.osrm --port 5000 --ip 0.0.0.0
```

### Paso 6: Verificar que funciona
```bash
# En otra terminal WSL o desde Windows PowerShell
curl "http://localhost:5000/route/v1/driving/-66.9036,10.4806;-66.8792,10.5089?overview=false"
```

---

## Opción 2: Usar Binarios Pre-compilados (Más Rápido)

Desafortunadamente, OSRM no proporciona binarios oficiales para Windows. La mejor opción es usar WSL2 como se describe arriba.

---

## Opción 3: Usar un Servicio OSRM Público (Para Desarrollo)

Si solo necesitas OSRM para desarrollo y pruebas, puedes usar el servidor público de OSRM:

### Actualizar .env
```bash
OSRM_URL=https://router.project-osrm.org
```

**⚠️ ADVERTENCIA:** El servidor público tiene límites de uso y no debe usarse en producción.

---

## Script de Inicio Automático (WSL2)

Crea un script para iniciar OSRM fácilmente:

### En WSL2: `~/start-osrm.sh`
```bash
#!/bin/bash
cd ~/osrm-data
osrm-routed --algorithm mld venezuela-latest.osrm --port 5000 --ip 0.0.0.0
```

```bash
chmod +x ~/start-osrm.sh
```

### Desde Windows PowerShell:
```powershell
# Iniciar OSRM
wsl ~/start-osrm.sh
```

---

## Script de PowerShell para Iniciar Todo

Crea `backend/start-dev.ps1`:

```powershell
# Iniciar OSRM en WSL2 (en segundo plano)
Start-Process wsl -ArgumentList "~/start-osrm.sh" -WindowStyle Minimized

# Esperar 5 segundos para que OSRM inicie
Start-Sleep -Seconds 5

# Iniciar servicios Docker (PostgreSQL, Redis, Backend)
docker-compose up
```

Uso:
```powershell
cd backend
.\start-dev.ps1
```

---

## Verificar Estado de OSRM

### Desde PowerShell:
```powershell
# Verificar que OSRM está corriendo
Invoke-WebRequest -Uri "http://localhost:5000/status" | Select-Object -ExpandProperty Content

# Probar routing
Invoke-WebRequest -Uri "http://localhost:5000/route/v1/driving/-66.9036,10.4806;-66.8792,10.5089?overview=false" | Select-Object -ExpandProperty Content
```

---

## Troubleshooting

### OSRM no inicia
```bash
# Verificar que los archivos procesados existen
ls -lh ~/osrm-data/venezuela-latest.osrm*

# Si faltan archivos, reprocesar
cd ~/osrm-data
osrm-extract -p car.lua venezuela-latest.osm.pbf
osrm-partition venezuela-latest.osrm
osrm-customize venezuela-latest.osrm
```

### Backend no puede conectarse a OSRM
```bash
# Verificar que OSRM está escuchando en todas las interfaces
netstat -tulpn | grep 5000

# Debe mostrar: 0.0.0.0:5000
```

### Puerto 5000 ya está en uso
```bash
# Cambiar puerto en start-osrm.sh
osrm-routed --algorithm mld venezuela-latest.osrm --port 5001 --ip 0.0.0.0

# Actualizar OSRM_URL en docker-compose.yml
OSRM_URL: http://host.docker.internal:5001
```

---

## Recursos

- [OSRM Documentation](http://project-osrm.org/)
- [OSRM GitHub](https://github.com/Project-OSRM/osrm-backend)
- [WSL2 Documentation](https://docs.microsoft.com/en-us/windows/wsl/)
