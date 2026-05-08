# Mapbox GL Native Installation Guide

## Step 1: Install Dependencies

```bash
cd app
npm install @react-native-mapbox-gl/maps @mapbox/mapbox-sdk react-native-svg
```

Or with yarn:
```bash
yarn add @react-native-mapbox-gl/maps @mapbox/mapbox-sdk react-native-svg
```

## Step 2: Configure Mapbox API Key

### Create/Update `.env` file

```
MAPBOX_API_KEY=your_mapbox_api_key_here
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

### Update `app.json`

Add Mapbox plugin configuration:

```json
{
  "expo": {
    "plugins": [
      [
        "@react-native-mapbox-gl/maps",
        {
          "RNMapboxMapsImpl": "mapbox"
        }
      ]
    ]
  }
}
```

## Step 3: Update Metro Configuration

Ensure `metro.config.js` includes SVG support:

```javascript
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  resolver: {
    sourceExts: ['js', 'json', 'ts', 'tsx', 'svg'],
  },
};
```

## Step 4: Update TypeScript Configuration

Add types for Mapbox in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": [
      "@react-native-mapbox-gl/maps"
    ]
  }
}
```

## Step 5: Update i18n Translations

Add map-related translations to `app/i18n/en.json`:

```json
{
  "map": {
    "pickup": "Pickup Location",
    "dropoff": "Dropoff Location",
    "driver": "Driver Location",
    "offlineMode": "Offline Mode",
    "loading": "Loading map...",
    "error": "Error loading map"
  },
  "errors": {
    "mapLoadFailed": "Failed to load map",
    "mapError": "An error occurred with the map"
  }
}
```

And `app/i18n/es.json`:

```json
{
  "map": {
    "pickup": "Ubicación de Recogida",
    "dropoff": "Ubicación de Destino",
    "driver": "Ubicación del Conductor",
    "offlineMode": "Modo Offline",
    "loading": "Cargando mapa...",
    "error": "Error cargando mapa"
  },
  "errors": {
    "mapLoadFailed": "Error al cargar el mapa",
    "mapError": "Ocurrió un error con el mapa"
  }
}
```

## Step 6: Create Logger Utility

Create `app/src/utils/logger.ts`:

```typescript
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data);
  },
  error: (message: string, data?: any) => {
    console.error(`[ERROR] ${message}`, data);
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data);
  },
  debug: (message: string, data?: any) => {
    console.debug(`[DEBUG] ${message}`, data);
  },
};

export default logger;
```

## Step 7: Test Installation

### Run on iOS

```bash
npm run ios
```

### Run on Android

```bash
npm run android
```

### Run on Web

```bash
npm run web
```

## Step 8: Verify Mapbox is Working

Create a test component:

```typescript
import React from 'react';
import { View } from 'react-native';
import MapboxGL from '@react-native-mapbox-gl/maps';

MapboxGL.setAccessToken(process.env.MAPBOX_API_KEY || '');

export const MapTest = () => (
  <View style={{ flex: 1 }}>
    <MapboxGL.MapView style={{ flex: 1 }}>
      <MapboxGL.Camera
        zoomLevel={15}
        centerCoordinate={[-74.0060, 40.7128]}
      />
    </MapboxGL.MapView>
  </View>
);
```

## Troubleshooting

### Issue: "Mapbox API key not set"

**Solution**: Ensure `MAPBOX_API_KEY` is set in `.env` and `MapboxGL.setAccessToken()` is called before rendering the map.

### Issue: "Module not found: @react-native-mapbox-gl/maps"

**Solution**: Run `npm install` again and clear cache:
```bash
npm install
npm start -- --reset-cache
```

### Issue: "SVG support not working"

**Solution**: Ensure `metro.config.js` includes `'svg'` in `sourceExts`.

### Issue: "Map not rendering on Android"

**Solution**: Add permissions to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### Issue: "Map not rendering on iOS"

**Solution**: Ensure `Info.plist` includes location permissions:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to show it on the map</string>
```

## Next Steps

1. ✅ Install dependencies
2. ✅ Configure Mapbox API key
3. ✅ Update app.json
4. ✅ Update metro.config.js
5. ✅ Add translations
6. ✅ Create logger utility
7. ✅ Test installation
8. [ ] Create MapView component (already done in `app/src/components/MapView.tsx`)
9. [ ] Create useMapbox hook (already done in `app/src/hooks/useMapbox.ts`)
10. [ ] Create map styles (already done in `app/src/styles/mapStyles.ts`)
11. [ ] Implement offline caching
12. [ ] Add real-time location updates
13. [ ] Write tests
14. [ ] Deploy to staging
15. [ ] User acceptance testing
16. [ ] Deploy to production

## Resources

- [Mapbox GL Native Documentation](https://docs.mapbox.com/ios/maps/overview/)
- [React Native Mapbox GL](https://github.com/react-native-mapbox-gl/maps)
- [Mapbox API Documentation](https://docs.mapbox.com/api/)
- [Expo Documentation](https://docs.expo.dev/)

## Support

For issues or questions:
1. Check the [Mapbox documentation](https://docs.mapbox.com/)
2. Review [GitHub issues](https://github.com/react-native-mapbox-gl/maps/issues)
3. Check [Stack Overflow](https://stackoverflow.com/questions/tagged/mapbox)
