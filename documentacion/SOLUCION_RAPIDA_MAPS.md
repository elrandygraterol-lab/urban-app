# Solución Rápida: Agregar Google Maps API Key

## 🎯 Problema

La app crashea después del registro porque falta la API key de Google Maps.

## ⚡ Solución Más Rápida (2 pasos)

### Paso 1: Obtener API Key (5 minutos)

1. Ve a: https://console.cloud.google.com/google/maps-apis/credentials
2. Si no tienes proyecto, créalo
3. Clic en "Crear credenciales" → "Clave de API"
4. Copia la API key (empieza con `AIza...`)

### Paso 2: Agregar a app.json (1 minuto)

Abre `app/app.json` y busca estas 3 ubicaciones:

**Ubicación 1** (línea ~25):
```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "PEGA_TU_API_KEY_AQUI"
    }
  }
}
```

**Ubicación 2** (línea ~15):
```json
"ios": {
  "config": {
    "googleMapsApiKey": "PEGA_TU_API_KEY_AQUI"
  }
}
```

**Ubicación 3** (línea ~45):
```json
"plugins": [
  [
    "react-native-maps",
    {
      "googleMapsApiKey": "PEGA_TU_API_KEY_AQUI"
    }
  ]
]
```

### Paso 3: Recompilar

```bash
cd app
eas build --profile development --platform android
```

Espera 15-20 minutos, instala la nueva build.

## 🆓 ¿Es Gratis?

Sí, Google Maps da **$200 USD gratis cada mes**. Para desarrollo es más que suficiente.

## 🚨 Importante

Después de agregar la API key, DEBES recompilar la app. No basta con reiniciar Metro.

## 📱 Mientras Esperas la Compilación

Puedes:
1. Restringir la API key en Google Cloud Console
2. Habilitar "Maps SDK for Android"
3. Tomar un café ☕

---

**Tiempo total**: ~25 minutos (5 min obtener key + 20 min compilar)
