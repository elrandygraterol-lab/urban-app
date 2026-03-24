#!/bin/bash

# Script para limpiar completamente y compilar la app desde cero
# Uso: bash scripts/clean-and-build.sh

set -e  # Detener si hay algún error

echo "🧹 Iniciando limpieza completa..."
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Limpiar Watchman (si está instalado)
echo -e "${YELLOW}[1/8]${NC} Limpiando Watchman..."
if command -v watchman &> /dev/null; then
    watchman watch-del-all 2>/dev/null || true
    echo -e "${GREEN}✓${NC} Watchman limpiado"
else
    echo -e "${YELLOW}⚠${NC} Watchman no instalado (opcional)"
fi
echo ""

# 2. Eliminar node_modules
echo -e "${YELLOW}[2/8]${NC} Eliminando node_modules..."
if [ -d "node_modules" ]; then
    rm -rf node_modules
    echo -e "${GREEN}✓${NC} node_modules eliminado"
else
    echo -e "${YELLOW}⚠${NC} node_modules no existe"
fi
echo ""

# 3. Eliminar .expo
echo -e "${YELLOW}[3/8]${NC} Eliminando cache de Expo..."
if [ -d ".expo" ]; then
    rm -rf .expo
    echo -e "${GREEN}✓${NC} .expo eliminado"
else
    echo -e "${YELLOW}⚠${NC} .expo no existe"
fi
echo ""

# 4. Eliminar package-lock.json
echo -e "${YELLOW}[4/8]${NC} Eliminando package-lock.json..."
if [ -f "package-lock.json" ]; then
    rm -f package-lock.json
    echo -e "${GREEN}✓${NC} package-lock.json eliminado"
else
    echo -e "${YELLOW}⚠${NC} package-lock.json no existe"
fi
echo ""

# 5. Limpiar cache de npm
echo -e "${YELLOW}[5/8]${NC} Limpiando cache de npm..."
npm cache clean --force
echo -e "${GREEN}✓${NC} Cache de npm limpiado"
echo ""

# 6. Reinstalar dependencias
echo -e "${YELLOW}[6/8]${NC} Instalando dependencias desde cero..."
echo -e "${YELLOW}⏳${NC} Esto puede tomar 2-3 minutos..."
npm install --legacy-peer-deps
echo -e "${GREEN}✓${NC} Dependencias instaladas"
echo ""

# 7. Verificar instalación
echo -e "${YELLOW}[7/8]${NC} Verificando instalación..."
if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
    echo -e "${GREEN}✓${NC} Instalación verificada correctamente"
else
    echo -e "${RED}✗${NC} Error en la instalación"
    exit 1
fi
echo ""

# 8. Compilar APK
echo -e "${YELLOW}[8/8]${NC} Compilando APK en EAS..."
echo -e "${YELLOW}⏳${NC} Esto puede tomar 15-20 minutos..."
echo ""
npm run build:dev:android

echo ""
echo -e "${GREEN}✓✓✓ Proceso completado exitosamente ✓✓✓${NC}"
echo ""
echo "📱 Próximos pasos:"
echo "1. Descarga la APK del link que apareció arriba"
echo "2. Desinstala la APK anterior de tu dispositivo"
echo "3. Instala la nueva APK"
echo "4. Ejecuta: npm run start:dev"
echo "5. Escanea el QR con la nueva APK"
echo ""
