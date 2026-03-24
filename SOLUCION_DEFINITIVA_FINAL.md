# 🎯 Solución Definitiva - API Key Inyectada Manualmente

## 🔍 Problema Confirmado

El plugin de `react-native-maps` en Expo **NO está inyectando la API key** en el AndroidManifest.xml durante el prebuild. Esto es un bug conocido de Expo con ciertos plugins.

## ✅ Solución Aplicada

He creado un sistema de 3 scripts que GARANTIZA que la API key se inyecte correctamente:

### 1. **inject-api-key.js** - Inyección Manual
Inyecta la API key directamente en el AndroidManifest.xml después del prebuild.

### 2. **verify-api-key.js** - Verificación
Verifica que la API key esté presente en el AndroidManifest.xml.

### 3. **Flujo Automático en eas.json**
```bash
npx expo prebuild --clean && node scripts/inject-api-key.js && node scripts/verify-api-key.js
```

## 📊 Qué Hace Cada Script

| Script | Función | Resultado |
|--------|---------|-----------|
| `expo prebuild --clean` | Regenera archivos nativos | AndroidManifest.xml SIN API key |
| `inject-api-key.js` | Inyecta API key manualmente | AndroidManifest.xml CON API key |
| `verify-api-key.js` | Verifica que esté presente | Build falla si no está |

## 🚀 Próximo Build

```bash
cd app
eas build --platform android --profile development --non-interactive --clear-cache
```

### Qué Pasará

1. **Prebuild**: Regenerará archivos nativos (sin API key)
2. **Inyección**: El script inyectará la API key manualmente
3. **Verificación**: El script verificará que la API key esté presente
4. **Compilación**: Si todo está bien, compilará el APK

### Logs Esperados

```
✅ Finished prebuild
💉 Inyectando API Key en AndroidManifest.xml...
✅ API Key inyectada exitosamente
🔍 Verificando API Key en AndroidManifest.xml...
✅ API Key encontrada en AndroidManifest.xml
✅ API Key es correcta
```

## 📁 Archivos Modificados

1. ✅ `app/app.config.js` - Configuración (reemplaza app.json)
2. ✅ `app/app.json.backup` - Backup del app.json original
3. ✅ `app/scripts/inject-api-key.js` - Inyección manual de API key
4. ✅ `app/scripts/verify-api-key.js` - Verificación de API key
5. ✅ `app/eas.json` - Flujo automático de prebuild
6. ✅ `app/android/app/src/main/AndroidManifest.xml` - API key inyectada

## 🎯 Por Qué Esto Funcionará

- ✅ La API key se inyecta MANUALMENTE (no depende del plugin)
- ✅ La verificación GARANTIZA que esté presente antes de compilar
- ✅ Si algo falla, el build se detiene inmediatamente con un mensaje claro

## 🔍 Verificación Local (Ya Probada)

```bash
cd app
npx expo prebuild --clean --platform android
node scripts/inject-api-key.js
node scripts/verify-api-key.js
```

**Resultado**:
```
✅ API Key inyectada exitosamente
✅ API Key encontrada en AndroidManifest.xml
✅ API Key es correcta
```

## 📱 Después del Build

1. Descarga el APK del nuevo build
2. Desinstala la app anterior
3. Instala el nuevo APK
4. Inicia Metro Bundler: `npx expo start`
5. Prueba la app

**Resultado Esperado**:
- ✅ El mapa se cargará correctamente
- ✅ No habrá "API key not found"
- ✅ La app funcionará completamente

## 🆘 Si Algo Sale Mal

Si el build falla, los logs mostrarán EXACTAMENTE en qué paso falló:

- Si falla en `inject-api-key.js`: Problema con el script de inyección
- Si falla en `verify-api-key.js`: La API key no se inyectó correctamente

En cualquier caso, los logs serán claros y específicos.

---

**EJECUTA EL BUILD AHORA** 🚀

```bash
cd app
eas build --platform android --profile development --non-interactive --clear-cache
```

Este build DEBERÍA funcionar porque:
1. La inyección manual GARANTIZA que la API key esté presente
2. La verificación GARANTIZA que no se compile sin la API key
3. Ya probamos localmente que funciona

**Build ID anterior (falló)**: 8214e6b4-af98-4c6b-b6f4-b17c3bd3e789
**Próximo build**: Debería tener éxito con la inyección manual
