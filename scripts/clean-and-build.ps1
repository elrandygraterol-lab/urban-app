$ErrorActionPreference = "Stop"

Write-Host "Iniciando limpieza completa..." -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/8] Limpiando Watchman..." -ForegroundColor Yellow
try {
    if (Get-Command watchman -ErrorAction SilentlyContinue) {
        watchman watch-del-all 2>$null
        Write-Host "Watchman limpiado" -ForegroundColor Green
    } else {
        Write-Host "Watchman no instalado (opcional)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error limpiando Watchman (continuando...)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[2/8] Eliminando node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
    Write-Host "node_modules eliminado" -ForegroundColor Green
} else {
    Write-Host "node_modules no existe" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[3/8] Eliminando cache de Expo..." -ForegroundColor Yellow
if (Test-Path ".expo") {
    Remove-Item -Recurse -Force ".expo"
    Write-Host ".expo eliminado" -ForegroundColor Green
} else {
    Write-Host ".expo no existe" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[4/8] Eliminando package-lock.json..." -ForegroundColor Yellow
if (Test-Path "package-lock.json") {
    Remove-Item -Force "package-lock.json"
    Write-Host "package-lock.json eliminado" -ForegroundColor Green
} else {
    Write-Host "package-lock.json no existe" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[5/8] Limpiando cache de npm..." -ForegroundColor Yellow
npm cache clean --force
Write-Host "Cache de npm limpiado" -ForegroundColor Green
Write-Host ""

Write-Host "[6/8] Instalando dependencias desde cero..." -ForegroundColor Yellow
Write-Host "Esto puede tomar 2-3 minutos..." -ForegroundColor Yellow
npm install --legacy-peer-deps
Write-Host "Dependencias instaladas" -ForegroundColor Green
Write-Host ""

Write-Host "[7/8] Verificando instalacion..." -ForegroundColor Yellow
if ((Test-Path "node_modules") -and (Test-Path "package-lock.json")) {
    Write-Host "Instalacion verificada correctamente" -ForegroundColor Green
} else {
    Write-Host "Error en la instalacion" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "[8/8] Compilando APK en EAS..." -ForegroundColor Yellow
Write-Host "Esto puede tomar 15-20 minutos..." -ForegroundColor Yellow
Write-Host ""
npm run build:dev:android

Write-Host ""
Write-Host "Proceso completado exitosamente" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos pasos:" -ForegroundColor Cyan
Write-Host "1. Descarga la APK del link que aparecio arriba" -ForegroundColor White
Write-Host "2. Desinstala la APK anterior de tu dispositivo" -ForegroundColor White
Write-Host "3. Instala la nueva APK" -ForegroundColor White
Write-Host "4. Ejecuta: npm run start:dev" -ForegroundColor White
Write-Host "5. Escanea el QR con la nueva APK" -ForegroundColor White
Write-Host ""
