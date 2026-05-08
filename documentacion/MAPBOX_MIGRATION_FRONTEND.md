# Frontend Migration: React Native Maps → Mapbox GL Native

## Overview

This document describes the migration from `react-native-maps` to `@react-native-mapbox-gl/maps` for the UrbanTaxi app.

## Dependencies to Add

```json
{
  "@react-native-mapbox-gl/maps": "^10.0.0",
  "@mapbox/mapbox-sdk": "^0.15.0",
  "react-native-svg": "^15.0.0"
}
```

## Dependencies to Remove

```json
{
  "react-native-maps": "^1.27.2"
}
```

## Installation Steps

### Step 1: Install Mapbox GL Native

```bash
cd app
npm install @react-native-mapbox-gl/maps @mapbox/mapbox-sdk react-native-svg
```

### Step 2: Configure Mapbox API Key

Update `app/.env`:
```
MAPBOX_API_KEY=your_mapbox_api_key_here
```

### Step 3: Update app.json (Expo Configuration)

Add Mapbox configuration:
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

### Step 4: Update Metro Configuration

Ensure metro.config.js includes SVG support:
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

## Component Migration

### Old (react-native-maps)
```typescript
import MapView, { Marker, Polyline } from 'react-native-maps';

<MapView
  style={{ flex: 1 }}
  initialRegion={{
    latitude: 40.7128,
    longitude: -74.0060,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  }}
>
  <Marker coordinate={{ latitude: 40.7128, longitude: -74.0060 }} />
  <Polyline coordinates={routeCoordinates} />
</MapView>
```

### New (Mapbox GL Native)
```typescript
import MapboxGL from '@react-native-mapbox-gl/maps';

MapboxGL.setAccessToken(MAPBOX_API_KEY);

<MapboxGL.MapView style={{ flex: 1 }}>
  <MapboxGL.Camera
    zoomLevel={15}
    centerCoordinate={[-74.0060, 40.7128]}
  />
  <MapboxGL.PointAnnotation
    id="marker"
    coordinate={[-74.0060, 40.7128]}
  />
  <MapboxGL.ShapeSource id="route" shape={routeGeoJSON}>
    <MapboxGL.LineLayer id="routeLine" style={lineStyle} />
  </MapboxGL.ShapeSource>
</MapboxGL.MapView>
```

## Files to Create

1. `app/src/components/MapView.tsx` - Main map component
2. `app/src/components/MapMarker.tsx` - Marker component
3. `app/src/components/MapRoute.tsx` - Route polyline component
4. `app/src/hooks/useMapbox.ts` - Mapbox utilities hook
5. `app/src/styles/mapStyles.ts` - Map styling

## Features to Implement

### 5.1 Install Mapbox GL Native
- [x] Add dependencies
- [x] Configure API key
- [x] Update app.json
- [ ] Test on iOS
- [ ] Test on Android

### 5.2 Create MapView Component
- [ ] Map initialization
- [ ] Marker rendering
- [ ] Route polyline rendering
- [ ] Real-time location updates
- [ ] Map interaction handlers
- [ ] Error handling

### 5.3 Implement Offline Map Caching
- [ ] Download offline maps
- [ ] Store offline data
- [ ] Detect offline mode
- [ ] Cache routes
- [ ] Test offline functionality

### 5.4 Update Map Styling
- [ ] Create custom Mapbox style
- [ ] Apply UrbanTaxi branding
- [ ] Implement dark mode
- [ ] Test on various devices

### 5.5 Write Frontend Integration Tests
- [ ] MapView component tests
- [ ] Route rendering tests
- [ ] Location update tests
- [ ] Offline functionality tests
- [ ] Styling tests

## Configuration

### Mapbox Style

Create custom style for UrbanTaxi:
- Primary color: #00B300 (green)
- Secondary color: #FF9500 (orange)
- Dark mode support
- Custom layers and labels

### Offline Maps

Configure offline map regions:
- Download tiles for service area
- Cache for 7 days
- Update weekly
- ~500MB per region

## Testing

### Unit Tests
- Component rendering
- Props validation
- Event handlers
- Error handling

### Integration Tests
- Full ride flow
- Real-time updates
- Offline functionality
- Map interactions

### Performance Tests
- Map rendering performance
- Location update latency
- Memory usage
- Battery consumption

## Migration Checklist

- [ ] Dependencies installed
- [ ] Mapbox API key configured
- [ ] app.json updated
- [ ] MapView component created
- [ ] Markers implemented
- [ ] Routes rendering
- [ ] Real-time updates working
- [ ] Offline maps configured
- [ ] Styling applied
- [ ] Tests passing
- [ ] iOS build successful
- [ ] Android build successful
- [ ] Performance acceptable
- [ ] User testing completed

## Rollback Plan

If issues occur:
1. Keep `react-native-maps` in package.json
2. Create feature flag for map provider
3. Switch back to `react-native-maps` if needed
4. Gradually migrate users

## Performance Targets

- Map initialization: <1 second
- Marker rendering: <500ms
- Route rendering: <1 second
- Location updates: <500ms
- Offline mode switch: <2 seconds

## Cost Impact

- Mapbox free tier: 50,000 requests/month
- Offline maps: ~500MB per region
- No additional costs for basic features

## Next Steps

1. Install dependencies
2. Configure Mapbox API key
3. Create MapView component
4. Implement markers and routes
5. Add real-time location updates
6. Implement offline caching
7. Apply custom styling
8. Write tests
9. Test on iOS and Android
10. Deploy to staging
11. User acceptance testing
12. Deploy to production
