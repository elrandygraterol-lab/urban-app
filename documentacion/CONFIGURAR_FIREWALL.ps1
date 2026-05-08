# Script para configurar Windows Firewall para UrbanTaxi Backend
# Ejecutar como Administrador

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  UrbanTaxi - Configuración Firewall" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si se está ejecutando como administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ ERROR: Este script debe ejecutarse como Administrador" -ForegroundColor Red
    Write-Host ""
    Write-Host "Pasos:" -ForegroundColor Yellow
    Write-Host "1. Clic derecho en PowerShell" -ForegroundColor Yellow
    Write-Host "2. Seleccionar 'Ejecutar como administrador'" -ForegroundColor Yellow
    Write-Host "3. Ejecutar este script nuevamente" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host "✅ Ejecutando como Administrador" -ForegroundColor Green
Write-Host ""

# Nombre de la regla
$ruleName = "Node.js Backend - All LAN"

# Verificar si la regla ya existe
Write-Host "🔍 Verificando reglas existentes..." -ForegroundColor Yellow
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "⚠️  Regla existente encontrada. Eliminando..." -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    Write-Host "✅ Regla anterior eliminada" -ForegroundColor Green
    Write-Host ""
}

# Crear nueva regla
Write-Host "🔧 Creando nueva regla de firewall..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Configuración:" -ForegroundColor Cyan
Write-Host "  - Nombre: $ruleName" -ForegroundColor White
Write-Host "  - Dirección: Inbound (Entrada)" -ForegroundColor White
Write-Host "  - Protocolo: TCP" -ForegroundColor White
Write-Host "  - Puerto: 3000" -ForegroundColor White
Write-Host "  - Acción: Allow (Permitir)" -ForegroundColor White
Write-Host "  - Red: 192.168.1.0/24 (Toda la LAN)" -ForegroundColor White
Write-Host "  - Perfil: Private, Domain" -ForegroundColor White
Write-Host ""

try {
    New-NetFirewallRule `
        -DisplayName $ruleName `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 3000 `
        -Action Allow `
        -RemoteAddress 192.168.1.0/24 `
        -Profile Private,Domain `
        -ErrorAction Stop | Out-Null
    
    Write-Host "✅ Regla de firewall creada exitosamente" -ForegroundColor Green
    Write-Host ""
    
    # Verificar la regla
    Write-Host "🔍 Verificando regla creada..." -ForegroundColor Yellow
    $newRule = Get-NetFirewallRule -DisplayName $ruleName
    
    if ($newRule) {
        Write-Host "✅ Regla verificada correctamente" -ForegroundColor Green
        Write-Host ""
        Write-Host "Detalles de la regla:" -ForegroundColor Cyan
        $newRule | Format-List DisplayName, Enabled, Direction, Action, Profile
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  ✅ CONFIGURACIÓN COMPLETADA" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Próximos pasos:" -ForegroundColor Yellow
        Write-Host "1. Desactivar ProtonVPN en el dispositivo conductor" -ForegroundColor White
        Write-Host "2. Reiniciar la app UrbanTaxi en el conductor" -ForegroundColor White
        Write-Host "3. Verificar que el indicador muestre 'Conectado' (verde)" -ForegroundColor White
        Write-Host "4. Solicitar un viaje desde el pasajero" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "⚠️  No se pudo verificar la regla" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ ERROR al crear la regla:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    pause
    exit 1
}

Write-Host "Presiona cualquier tecla para salir..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
