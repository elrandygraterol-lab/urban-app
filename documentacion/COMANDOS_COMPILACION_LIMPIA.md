# 🚀 Comandos para Compilación Limpia Desde Cero

## 📍 Ubicación Actual
Estás en: `~/OneDrive/Desktop/app-taxis/`

## ✅ Opción 1: Script Automático (RECOMENDADO)

### Para Git Bash / WSL (lo que estás usando):

```bash
cd app
npm run clean:full
```

### Para PowerShell (alternativa):

```powershell
cd app
npm run clean:full:windows
```

---

## ✅ Opción 2: Comandos Manuales (Si el script falla)

```bash
# 1. Ir al directorio de la app
cd app

# 2. Limpiar Watchman (opcional, si está instalado)
watchman watch-del-all 2>/dev/null || echo "Watchman no instalado"

# 3. Eliminar node_modules
rm -rf node_modules

# 4. Eliminar .expo
rm -rf .expo

# 5. Eliminar package-lock.json
rm -f package-lock.json

# 6. Limpiar cache de npm
npm cache clean --force

# 7. Reinstalar dependencias desde cero
npm install --legacy-peer-deps

# 8. Compilar APK con cache limpio
npm run build:dev:android
```

---

## 📊 Qué Esperar

### Durante la Limpieza (30 segundos):
```
🧹 Iniciando limpieza completa...
[1/8] Limpiando Watchman...
[2/8] Eliminando node_modules...
[3/8] Eliminando cache de Expo...
[4/8] Eliminando package-lock.json...
[5/8] Limpiando cache de npm...
```

### Durante la Instalación (2-3 minutos):
```
[6/8] Instalando dependencias desde cero...
⏳ Esto puede tomar 2-3 minutos...
added 1262 packages, and audited 1263 packages in 1m
```

### Durante la Compilación (15-20 minutos):
```
[8/8] Compilando APK en EAS...
⏳ Esto puede tomar 15-20 minutos...

Compressing project files and uploading to EAS Build...
✓ Compressed project files
✓ Uploaded to EAS
✓ Build finished

🤖 Open this link on your Android devices (or scan the QR code) to install the app:
https://expo.dev/accounts/randygraterol07/projects/app-taxis/builds/[BUILD_ID]
```

---

## ⏱️ Tiempo Total Estimado

| Fase | Tiempo |
|------|--------|
| Limpieza | ~30 segundos |
| Instalación | ~2-3 minutos |
| Compilación EAS | ~15-20 minutos |
| **TOTAL** | **~20-25 minutos** |

---

## 📱 Después de la Compilación

1. **Descargar APK**
   - Copia el link que aparece al final
   - Ábrelo en tu navegador
   - Descarga la APK

2. **Desinstalar APK anterior**
   - Ve a Configuración → Apps
   - Busca "app-taxis"
   - Desinstalar

3. **Instalar nueva APK**
   - Abre el archivo descargado
   - Instalar

4. **Iniciar servidor de desarrollo**
   ```bash
   npm run start:dev
   ```

5. **Conectar con la app**
   - Abre la app instalada
   - Escanea el QR que aparece en la terminal

---

## 🎯 Verificación de Éxito

### ✅ Señales de que todo está bien:

1. **Durante instalación**:
   ```
   added 1262 packages
   found 0 vulnerabilities
   ```

2. **Durante build**:
   ```
   ✓ Build finished
   ```

3. **Al conectar**:
   - La app se abre sin errores
   - No aparece el error de ReactFabric
   - Puedes navegar por la app

### ❌ Señales de problemas:

1. **Durante instalación**:
   ```
   npm ERR! peer dependency conflict
   ```
   **Solución**: Asegúrate de usar `--legacy-peer-deps`

2. **Durante build**:
   ```
   × Build failed
   ```
   **Solución**: Revisa los logs en el link de EAS

3. **Al conectar**:
   ```
   Cannot read property 'S' of undefined
   ```
   **Solución**: Verifica que instalaste la APK nueva (no la anterior)

---

## 🆘 Solución de Problemas

### Problema: "npm install" falla

```bash
# Limpiar TODO de nuevo
rm -rf node_modules .expo package-lock.json
npm cache clean --force

# Reinstalar con verbose para ver detalles
npm install --legacy-peer-deps --verbose
```

### Problema: Build falla en EAS

1. Copia el link de logs que proporciona EAS
2. Busca la línea con "ERROR" o "FAILURE"
3. Pega el error completo en el chat

### Problema: La app sigue con el mismo error

1. Verifica que desinstalaste la APK anterior
2. Verifica que instalaste la APK nueva (revisa la fecha de descarga)
3. Reinicia tu dispositivo
4. Vuelve a instalar la APK

---

## 📝 Notas Importantes

1. **No interrumpas el proceso**: Deja que termine completamente
2. **Conexión a internet**: Necesaria durante todo el proceso
3. **Espacio en disco**: ~2GB libres requeridos
4. **Paciencia**: La compilación en EAS toma tiempo, es normal

---

## 🎬 Comando Final (Copia y Pega)

```bash
cd app && npm run clean:full
```

O si prefieres ver cada paso:

```bash
cd app && \
rm -rf node_modules .expo package-lock.json && \
npm cache clean --force && \
npm install --legacy-peer-deps && \
npm run build:dev:android
```

---

**¿Listo?** Copia el comando y pégalo en tu terminal Git Bash.
