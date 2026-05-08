# Comandos OSRM - Guía Rápida

## 📋 Comandos Disponibles

### Gestión de OSRM

```bash
# Iniciar OSRM (se ejecuta en primer plano - mantén la terminal abierta)
npm run osrm:start

# Detener OSRM (en otra terminal)
npm run osrm:stop

# Ver estado de OSRM
npm run osrm:status

# Configurar/Instalar OSRM (solo primera vez)
npm run osrm:setup
```

### Comandos Combinados

```bash
# Iniciar servicios Docker (en otra terminal mientras OSRM corre)
npm run docker:up

# Detener todo
npm run osrm:stop && npm run docker:down
```

---

## 🖥️ Uso Recomendado en Windows

### Primera Vez: Instalar OSRM
```bash
npm run osrm:setup
```

### Uso Diario: 3 Terminales

**Terminal 1: OSRM**
```bash
cd backend
npm run osrm:start
# Deja esta terminal abierta - OSRM corre aquí
```

**Terminal 2: Servicios Docker**
```bash
cd backend
npm run docker:up
# O para ver logs: docker-compose up
```

**Terminal 3: Backend en Desarrollo (opcional)**
```bash
cd backend
npm run dev
```

---

## 🔍 Verificación

### Verificar que OSRM está corriendo

```bash
# Ver estado
npm run osrm:status

# Probar endpoint desde WSL
wsl curl -s "http://localhost:5000/route/v1/driving/-66.9,10.5;-66.8,10.6?overview=false"
```

### Verificar desde el Backend

```bash
# Una vez que el backend esté corriendo
curl http://localhost:3000/api/health
```

---

## 🐛 Troubleshooting

### OSRM no inicia

```bash
# Verificar que está instalado
wsl which osrm-routed

# Verificar datos
wsl ls -lh ~/osrm-data/venezuela-latest.osrm*

# Ver logs si falla
wsl cat /tmp/osrm.log
```

### Puerto ocupado

```bash
# Ver qué está usando el puerto 5000
npm run osrm:status

# Detener OSRM
npm run osrm:stop
```

### Backend no puede conectarse

```bash
# Verificar URL en .env
cat .env | grep OSRM_URL
# Debe ser: OSRM_URL=http://localhost:5000

# Verificar que OSRM responde
wsl curl http://localhost:5000/
```

---

## 🚀 Flujo de Trabajo Típico

### Desarrollo (Windows)

```bash
# Terminal 1: Iniciar OSRM
npm run osrm:start

# Terminal 2 (nueva): Iniciar Docker
npm run docker:up

# Terminal 3 (nueva): Desarrollo
npm run dev
```

### Detener Todo

```bash
# Terminal 2: Detener Docker
npm run docker:down

# Terminal 1: Ctrl+C para detener OSRM
# O desde otra terminal:
npm run osrm:stop
```

---

## 📝 Notas Importantes

1. **OSRM corre en primer plano**: Mantén la terminal abierta o usa `Ctrl+C` para detener
2. **WSL2 requerido**: OSRM corre en WSL2, no en Windows nativo
3. **Puerto 5000**: OSRM usa este puerto por defecto
4. **Datos persistentes**: Los datos procesados se mantienen entre reinicios
5. **AlmaLinux**: En producción, usa systemd en lugar de npm scripts
