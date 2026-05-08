# Solución: Google Maps API Key Requerida

## 🔴 Problema

La app crashea después del registro con este error:
```
java.lang.IllegalStateException: API key not found
at com.google.android.gms.maps.internal.CreatorImpl
```

**Causa**: La app usa Google Maps pero no tiene una API key configurada.

## ✅ Solución Rápida (5 minutos)

### Paso 1: Obtener API Key de Google Maps (GRATIS)

1. **Ve a Google Cloud Console**:
   https://console.cloud.google.com/

2. **Crea un proyecto** (si no tienes uno):
   - Clic en el selector de proyectos (arriba)
   - Clic en "Nuevo proyecto"
   - Nombre: `UrbanTaxi` o cualquier nombre
   - Clic en "Crear"

3. **Habilita la API de Maps**:
   - Ve a: https://console.cloud.google.com/apis/library
   - Busca: "Maps SDK for Android"
   - Clic en "Maps SDK for Android"
   - Clic en "Habilitar"

4. **Crea una API Key**:
   - Ve a: https://console.cloud.google.com/apis/credentials
   - Clic en "Crear credenciales"
   - Selecciona "Clave de API"
   - Copia la API key que aparece

### Paso 2: Agregar la API Key a la App

Abre el archivo `app/app.json` y busca estas secciones:

```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": ""  // ← Pega tu API key aquí
    }
  }
},
"plugins": [
  [
    "react-native-maps",
    {
      "googleMapsApiKey": ""  // ← Pega tu API key aquí también
    }
  ]
]
```

Reemplaza las comillas vacías `""` con tu API key:

```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    }
  }
},
"plugins": [
  [
    "react-native-maps",
    {
      "googleMapsApiKey": "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    }
  ]
]
```

### Paso 3: Recompilar la App

Como cambiaste `app.json`, necesitas recompilar:

```bash
cd app
eas build --profile development --platform android
```

Espera 15-20 minutos, luego instala la nueva build en tu dispositivo.

## 🆓 Límites Gratuitos de Google Maps

Google Maps ofrece **$200 USD de crédito gratis cada mes**, que equivale a:
- **28,500 cargas de mapa** por mes
- **40,000 solicitudes de geocodificación** por mes
- **40,000 solicitudes de direcciones** por mes

Para una app en desarrollo, esto es más que suficiente.

## 🔒 Restringir la API Key (Recomendado)

Para evitar uso no autorizado:

1. Ve a: https://console.cloud.google.com/apis/credentials
2. Clic en tu API key
3. En "Restricciones de aplicación":
   - Selecciona "Aplicaciones de Android"
   - Agrega: `com.urbantaxi.passenger`
   - Agrega tu SHA-1 fingerprint (opcional para desarrollo)
4. En "Restricciones de API":
   - Selecciona "Restringir clave"
   - Marca solo: "Maps SDK for Android"
5. Clic en "Guardar"

## 🚀 Alternativa: Usar OpenStreetMap (Sin API Key)

Si no quieres usar Google Maps, puedes cambiar a OpenStreetMap (completamente gratis, sin límites):

### Ventajas
- ✅ Completamente gratis
- ✅ Sin límites de uso
- ✅ Sin API key necesaria
- ✅ Open source

### Desventajas
- ❌ Menos detallado que Google Maps
- ❌ Menos funcionalidades
- ❌ Requiere cambios en el código

Si quieres usar OpenStreetMap, avísame y te ayudo a hacer los cambios.

## 📝 Resumen de Pasos

1. ✅ Obtener API key de Google Maps (5 min)
2. ✅ Agregar API key a `app/app.json` (1 min)
3. ✅ Recompilar la app con EAS Build (15-20 min)
4. ✅ Instalar nueva build en dispositivo (2 min)
5. ✅ Probar la app - debería funcionar sin errores

## 🐛 Si Sigue Sin Funcionar

Si después de agregar la API key y recompilar sigue sin funcionar:

1. Verifica que la API key esté correcta (sin espacios extra)
2. Verifica que "Maps SDK for Android" esté habilitada
3. Espera 5-10 minutos (a veces Google tarda en activar la key)
4. Verifica los logs del backend para otros errores

## 💡 Tip

Mientras esperas la compilación, puedes:
- Configurar restricciones en la API key
- Explorar otras funcionalidades del backend
- Revisar la documentación de Google Maps

---

**Tiempo total estimado**: 25-30 minutos (incluyendo compilación)
