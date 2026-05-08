# Zone Fare System Fixes

## Issues Fixed

### 1. JSON Parsing Error ✅
**Problem**: `SyntaxError: Failed to execute 'json' on 'Response': Unexpected end of JSON input`

**Root Cause**: The frontend was trying to parse JSON from responses that had no body (like 204 No Content responses from DELETE operations).

**Solution**: Updated all fetch calls in `backend/public/js/fares-zones.js` to handle empty responses properly.

### 2. Content Security Policy (CSP) Issues ✅
**Problems**: 
- `Ignoring duplicate Content-Security-Policy directive 'script-src'`
- `Tracking Prevention blocked access to storage for https://cdn.jsdelivr.net/npm/chart.js`

**Root Cause**: 
- Two different CSP configuration files were conflicting
- Missing CDN domains in CSP configuration

**Solution**: 
- **Removed duplicate** `securityHeaders.ts` file (not being used)
- **Updated** `security.ts` to include Google Translate domains
- **Verified** Chart.js and Leaflet CDNs are already whitelisted:
  - `cdn.jsdelivr.net` ✅ (Chart.js)
  - `unpkg.com` ✅ (Leaflet)
  - `cdnjs.cloudflare.com` ✅ (Leaflet.draw)

### 3. selectedFareType Being Reset ⚠️ (DEBUGGING)
**Problem**: "Tipo de tarifa no seleccionado" error when trying to create zones

**Root Cause**: The `selectedFareType` variable is being reset to `null` at some point in the process.

**Debug Changes Made**:
- Added extensive logging to `saveNewZone()` and `proceedWithSelectedFareType()`
- Modified `cancelDrawingMode()` to optionally preserve `selectedFareType`
- Added `debugZoneState()` function for real-time debugging

## Current CSP Configuration ✅

The active CSP configuration in `backend/src/middleware/security.ts` now includes:

```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      'cdn.jsdelivr.net',        // ✅ Chart.js
      'unpkg.com',               // ✅ Leaflet
      'cdnjs.cloudflare.com',    // ✅ Leaflet.draw
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      'unpkg.com',               // ✅ Leaflet CSS
      'cdnjs.cloudflare.com',    // ✅ Leaflet.draw CSS
    ],
    connectSrc: [
      "'self'", 
      'translate.googleapis.com', // ✅ Google Translate
      'translate.google.com',     // ✅ Google Translate
      'wss:', 
      'ws:'
    ],
    // ... other directives
  }
}
```

## Testing Instructions

### To verify CSP fixes:
1. **Open browser console** (F12)
2. **Go to admin dashboard** with charts
3. **Check for CSP errors** - should be resolved:
   - ❌ ~~`Ignoring duplicate Content-Security-Policy directive`~~
   - ❌ ~~`Tracking Prevention blocked access to storage for cdn.jsdelivr.net`~~

### To test selectedFareType issue:
1. **Open the admin panel** → Go to `/admin/tarifas`
2. **Open browser console** (F12) to see debug logs
3. **Click "Nueva Zona"** - should show fare type selection modal
4. **Select a fare type** and click "Continuar"
5. **Draw a polygon** on the map
6. **Fill in the form** and click "Guardar Zona"
7. **Check console logs** for debugging information

## Files Modified

1. ✅ `backend/src/middleware/security.ts` - Updated CSP with Google Translate domains
2. ✅ `backend/src/middleware/securityHeaders.ts` - **DELETED** (duplicate file)
3. ✅ `backend/src/__tests__/middleware/securityHeaders.test.ts` - Updated import path
4. ⚠️ `backend/public/js/fares-zones.js` - JSON parsing fixes + debugging (temporary)

## Next Steps

1. **Test CSP fixes** - verify no more duplicate directive errors
2. **Test Chart.js loading** - verify CDN access is working
3. **Debug selectedFareType issue** - use console logs to identify where it's being reset
4. **Remove debug code** once selectedFareType issue is resolved