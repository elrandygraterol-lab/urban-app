# Informe: Bug de Iconos de Mapa Cuadrados en GPUs Específicas de Android

**Fecha:** 2026-07-03  
**Estado:** PENDIENTE DE SOLUCIÓN DEFINITIVA  
**Archivo central:** `src/components/map/markers.tsx`  
**Bug doc existente:** `docs/BUG_MARKER_ICONOS_CUADRADOS.md` (desactualizada — describe v2, no v3)

---

## 1. Descripción del Bug

Los iconos del mapa (taxi, pasajero, punto de recogida, punto de destino, tiendas) aparecen con la **esquina inferior derecha cuadrada** mientras las demás esquinas son redondas. Afecta solo a ciertos dispositivos Android con GPUs MediaTek (Mali) y Exynos.

### Dispositivos afectados
| Dispositivo | SoC | GPU |
|-------------|-----|-----|
| Tecno Spark 10 Pro | Helio G88 | Mali-G52 |
| Poco X3 GT | Dimensity 1100 | Mali-G77 |
| Tecno Camon 30 | MediaTek | Mali |
| Tecno Spark Go 1 | MediaTek | Mali |
| Samsung A25 | Exynos | Mali-G68 |

### Dispositivo NO afectado
| Dispositivo | SoC | GPU |
|-------------|-----|-----|
| Redmi 10C | Snapdragon 680 | Adreno 610 |

**Patrón:** GPUs Adreno (Qualcomm) renderizan correctamente. GPUs Mali (MediaTek/Samsung) y Exynos muestran el artifact en la esquina inferior derecha.

---

## 2. Diagnóstico Técnico

### 2.1 Cómo funciona el renderizado de marcadores

`react-native-maps` convierte los componentes `View` hijos de un `<Marker>` en una **textura OpenGL** (bitmap) que Google Maps renderiza como overlay sobre el mapa. El proceso es:

```
React Native View tree → Snapshot → Bitmap (textura OpenGL) → Overlay en mapa nativo
```

### 2.2 Causa raíz del artifact

En GPUs Mali/Exynos, cuando se toma un snapshot de un `View` con `borderRadius` y `overflow: 'hidden'`:

1. **OpenGL procesa texturas de abajo hacia arriba** (coordenadas Y invertidas respecto a la UI)
2. **El último píxel de la textura** (esquina inferior derecha en coordenadas de UI = esquina superior en coordenadas OpenGL) **no recibe correctamente el clip de `borderRadius`**
3. El resultado: la textura renderizada muestra la esquina inferior derecha como un cuadrado porque el driver GPU omitió el recorte circular para ese último píxel
4. Las GPUs Adreno manejan internamente una pasada de post-procesado que corrige este borde; las Mali/Exynos no

### 2.3 Por qué `renderToHardwareTextureAndroid` ayuda parcialmente

`renderToHardwareTextureAndroid={true}` fuerza que el View se renderice en una textura de hardware separada (usando `RenderTexture` en Android). Esto **aísla** el View del compositor principal y obliga al GPU a procesarlo como una unidad independiente. Sin embargo:

- No garantiza que el clip de `borderRadius` se aplique correctamente a TODOS los píxeles del borde
- Algunas GPUs Mali manejan texturas de hardware de forma diferente a texturas normales
- El artifact puede ser **menos visible** pero no desaparece por completo

### 2.4 El problema con `react-native-maps` `Image`/`icon` prop

`react-native-maps` soporta el prop `icon` en `<Marker>` que acepta una imagen local (require). Cuando se usa este prop, **Google Maps SDK nativo** renderiza el icono directamente como un `BitmapDescriptor`, saltándose por completo la conversión View→textura de React Native. Esto elimina el artifact porque el GPU ya no tiene que recortar un View de React Native — la imagen ya está pre-recortada como PNG circular.

---

## 3. Historial de Intentos de Solución

### 3.1 v1 — Original (pre-0942246)

**Técnica:** `View` con `backgroundColor` + `borderRadius` + `borderWidth: 3` + `elevation`

```tsx
// APPROACH (no disponible — código ya no existe)
<View style={{
  width: 44, height: 44,
  borderRadius: 22,
  backgroundColor: color,
  borderWidth: 3,
  borderColor: '#FFFFFF',
  elevation: 4,
  alignItems: 'center',
  justifyContent: 'center',
}}>
  <Ionicons name="person" size={22} color="#FFFFFF" />
</View>
```

**Resultado:** ❌ Falló. `elevation` (sombra) + `borderRadius` es un bug conocido de React Native en Android. La sombra impide el clip circular y las esquinas quedan cuadradas, especialmente visible en GPUs Mali.

---

### 3.2 v2 — SVG Circles (commit `0942246`, Jun 25 2026)

**Técnica:** `Svg` `<Circle>` (de `react-native-svg`) para dibujar los círculos blanco y coloreado, con `View` contenedor transparente

```tsx
const CircleMarker = ({ size, color, children }) => {
  const inner = size - BORDER * 2;
  const center = size / 2;
  return (
    <View style={{
      width: size, height: size,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'transparent',    // ← Evita fondo opaco
      borderRadius: size / 2,           // ← Fuerza textura circular
    }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={center} cy={center} r={center - 0.2} fill="#FFFFFF" />
        <Circle cx={center} cy={center} r={inner / 2} fill={color} />
      </Svg>
      <View style={{ width: inner, height: inner, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
};
```

**Ajustes aplicados:**
- `backgroundColor: 'transparent'` — evita fondo opaco en GPUs que no heredan transparencia
- `borderRadius: size / 2` — obliga a `react-native-maps` a recortar la textura como círculo
- `center - 0.2` en el radio del SVG — margen de 0.2px para que el anti-aliasing no toque el borde exacto

**Cambios adicionales:**
- `StoreMapView.tsx`: Separación shadow/clip en Views anidados (sombra afuera, clip adentro con `overflow: 'hidden'`)
- `SecondPickupIcon`/`SecondDropoffIcon`: tamaño 14→26 en passenger index
- `DropoffIcon` en active-ride: tamaño 24→40

**Resultado:** ❌ Falló. El anti-aliasing del SVG generaba artifacts en los bordes en GPUs Mali. Además, `backgroundColor: 'transparent'` no era suficiente — algunas GPUs renderizaban el fondo como opaco de todas formas. La esquina inferior derecha seguía cuadrada.

---

### 3.3 v3 — Views Anidados + Hardware Texture (commit `c8abaa4`, Jul 2 2026 — ACTUAL)

**Técnica:** Views anidados con `borderRadius` + `overflow: 'hidden'` + `renderToHardwareTextureAndroid`

**Archivo:** `src/components/map/markers.tsx` (83 líneas)

```tsx
const CircleMarker: React.FC<{ size: number; color: string; children: React.ReactNode }> = ({
  size, color, children,
}) => {
  const innerSize = size - BORDER * 2;
  return (
    <View style={{
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: '#FFFFFF',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}
      renderToHardwareTextureAndroid={Platform.OS === 'android'}  // ← Fuerza textura hardware
    >
      <View style={{
          width: innerSize, height: innerSize,
          borderRadius: innerSize / 2,
          backgroundColor: color,
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
};
```

**Cambios respecto a v2:**
- Eliminada dependencia de `react-native-svg` (no más `<Circle>`)
- Dos Views anidados: externo blanco (el borde), interno coloreado
- Ambos con `borderRadius: X / 2` y `overflow: 'hidden'`
- `renderToHardwareTextureAndroid` en el View externo
- `tracksViewChanges` eliminado de los `<Marker>` (era `true` en active-ride — forzaba regenerar textura cada frame, empeorando el problema)

**Archivos modificados en este commit:**
| Archivo | Cambio |
|---------|--------|
| `src/components/map/markers.tsx` | SVG→Views anidados; +`renderToHardwareTextureAndroid` |
| `components/stores/StoreMapView.tsx` | +`renderToHardwareTextureAndroid` en markerCircle |
| `app/(driver)/active-ride.tsx` | -`tracksViewChanges={true}` |

**Resultado:** ⚠️ **Sigue fallando.** El artifact en la esquina inferior derecha persiste en los dispositivos afectados. El bug doc dice "Confianza 92%" pero el error continúa.

---

## 4. Catálogo de Soluciones Potenciales No Intentadas

A continuación se presentan 8 enfoques alternativos, ordenados por probabilidad de éxito y facilidad de implementación.

---

### Solución A — Usar imágenes PNG pre-renderizadas con el prop `icon` nativo ⭐⭐⭐⭐⭐

**Viabilidad:** Alta | **Esfuerzo:** Medio | **Probabilidad de éxito:** 95%

**Concepto:** En lugar de usar `View` como hijos del `<Marker>`, usar el prop `icon` de `react-native-maps` que acepta una imagen local (`require()` o `{ uri }`). Google Maps SDK nativo renderiza la imagen directamente como `BitmapDescriptor`, saltándose la conversión View→textura.

**Implementación:**

```tsx
// En lugar de:
<Marker coordinate={...}>
  <DriverTaxiIcon />
</Marker>

// Usar:
<Marker
  coordinate={...}
  icon={require('../../assets/markers/taxi-marker.png')}
/>
```

**Assets necesarios (PNG sin fondo, 96×96 px @3x):**

```
assets/markers/
  ├── taxi-marker.png          (círculo gris oscuro con icono taxi blanco)
  ├── passenger-marker.png     (círculo naranja con icono persona blanco)
  ├── pickup-marker.png        (círculo naranja con icono location blanco)
  ├── dropoff-marker.png       (círculo verde con icono location blanco)
  ├── second-pickup-marker.png (círculo naranja con icono person-add blanco)
  └── second-dropoff-marker.png (círculo verde con icono flag blanco)
```

**Ventajas:**
- Elimina el problema de raíz: no hay View de React Native que convertir a textura
- Google Maps SDK maneja el renderizado del icono con su propio pipeline GPU
- Compatible con TODOS los dispositivos y GPUs
- Mejor rendimiento (no genera texturas en cada frame)

**Desventajas:**
- Los iconos son fijos (no se pueden cambiar colores dinámicamente)
- Si se necesita cambiar color, hay que generar nuevos PNGs
- Cada variante de tamaño necesita su propio asset

**Cómo generar los PNGs:** Se pueden crear con cualquier herramienta de diseño (Figma, Illustrator, etc.) o mediante un script que use `react-native-svg` + `expo-image-manipulator` para generarlos programáticamente al iniciar la app.

---

### Solución B — Generar marcadores como imagen al iniciar la app ⭐⭐⭐⭐

**Viabilidad:** Alta | **Esfuerzo:** Alto | **Probabilidad de éxito:** 90%

**Concepto:** Usar `react-native-svg` para renderizar el marcador y luego capturarlo como PNG usando `expo-image-manipulator` o una librería de canvas. El PNG resultante se cachea en el filesystem y se usa como `icon` del `Marker`. Esto mantiene la flexibilidad de colores dinámicos pero elimina el problema GPU.

**Implementación conceptual:**

```tsx
// Al iniciar la app:
import * as FileSystem from 'expo-file-system';
import { SvgXml } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

async function generateMarkerImage(size: number, color: string, iconName: string): Promise<string> {
  const cacheKey = `marker_${size}_${color}_${iconName}`;
  const cachedPath = `${FileSystem.cacheDirectory}${cacheKey}.png`;
  
  // Verificar si ya existe en caché
  const info = await FileSystem.getInfoAsync(cachedPath);
  if (info.exists) return cachedPath;
  
  // Renderizar y capturar
  // (requiere un View temporal fuera de pantalla)
  // ... usar captureRef o similar para generar PNG
  
  return cachedPath;
}
```

**Nota:** Esta solución requiere más investigación sobre la API de `captureRef` / `takeSnapshotAsync` en React Native para asegurar que la captura no herede los mismos artifacts GPU.

---

### Solución C — `renderToHardwareTextureAndroid` en TODOS los Views anidados ⭐⭐

**Viabilidad:** Alta | **Esfuerzo:** Bajo | **Probabilidad de éxito:** 30%

**Concepto:** Actualmente solo el View externo tiene `renderToHardwareTextureAndroid`. Agregarlo también al View interno coloreado y probar si eso fuerza al GPU a procesar cada capa correctamente.

```tsx
<View style={{ ... }} renderToHardwareTextureAndroid={true}>
  <View style={{ ... }} renderToHardwareTextureAndroid={true}>
    {children}
  </View>
</View>
```

**Riesgo:** Puede empeorar el rendimiento al crear múltiples texturas de hardware por marker. Si hay 5+ markers en pantalla, son 10+ texturas de GPU activas simultáneamente.

---

### Solución D — `needsOffscreenAlphaCompositing` ⭐⭐

**Viabilidad:** Alta | **Esfuerzo:** Bajo | **Probabilidad de éxito:** 25%

**Concepto:** React Native ofrece el prop `needsOffscreenAlphaCompositing` que fuerza al View a renderizarse en un buffer off-screen antes de componerse. Esto puede cambiar cómo el GPU maneja la transparencia y los bordes.

```tsx
<View
  style={{ ... }}
  renderToHardwareTextureAndroid={true}
  needsOffscreenAlphaCompositing={true}
>
```

**Riesgo:** Similar a `renderToHardwareTextureAndroid` — impacto en rendimiento con múltiples markers.

---

### Solución E — Elevation explícito a 0 ⭐

**Viabilidad:** Alta | **Esfuerzo:** Bajo | **Probabilidad de éxito:** 15%

**Concepto:** Agregar `elevation: 0` explícitamente en el estilo del View contenedor. Algunas versiones de Android asignan una elevation por defecto que interfiere con `overflow: 'hidden'`.

```tsx
<View style={{
  ...styles,
  elevation: 0,          // ← Explícito
  shadowOpacity: 0,      // ← iOS
}}>
```

---

### Solución F — Contenedor cuadrado más grande con `overflow: 'hidden'` ⭐⭐

**Viabilidad:** Media | **Esfuerzo:** Medio | **Probabilidad de éxito:** 35%

**Concepto:** En lugar de que el contenedor tenga el mismo tamaño que el círculo, usar un contenedor cuadrado **más grande** (ej. size + 4px) con `overflow: 'hidden'` para que el clip se aplique con margen de sobra. La idea es que el último píxel del borde quede dentro del área segura.

```tsx
<View style={{
  width: size + 4,       // ← Contenedor más grande
  height: size + 4,
  borderRadius: (size + 4) / 2,
  backgroundColor: 'transparent',  // ← Fondo transparente
  overflow: 'hidden',
  alignItems: 'center',
  justifyContent: 'center',
}}>
  <View style={{
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  }}>
    {/* inner colored circle */}
  </View>
</View>
```

**Riesgo:** El padding extra podría hacer que el marker se vea desplazado del punto de coordenada.

---

### Solución G — Migrar a `@rnmapbox/maps` ⭐⭐⭐

**Viabilidad:** Baja | **Esfuerzo:** Muy alto | **Probabilidad de éxito:** 85%

**Concepto:** `@rnmapbox/maps` es una alternativa a `react-native-maps` que usa Mapbox GL en lugar de Google Maps. Tiene un sistema de renderizado de markers diferente (basado en WebGL/Metal en lugar de OpenGL ES) que podría no tener el mismo bug.

**Desventajas:**
- Migración masiva de código (todas las pantallas con mapa)
- Cambio de proveedor de mapas (Google Maps → Mapbox)
- Curva de aprendizaje
- Posibles costos de API de Mapbox

**No recomendado** a menos que todas las demás soluciones fallen.

---

### Solución H — Usar `react-native-svg` embebido en un `Image` con `source={{ uri: data:image/svg+xml }}` ⭐⭐

**Viabilidad:** Media | **Esfuerzo:** Medio | **Probabilidad de éxito:** 40%

**Concepto:** Renderizar el SVG como string y usarlo como fuente de imagen inline. Esto fuerza a que el motor de renderizado de imágenes (no el de Views) procese el SVG.

```tsx
const svgString = `<svg xmlns="..." width="${size}" height="${size}">
  <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#FFFFFF"/>
  <circle cx="${size/2}" cy="${size/2}" r="${inner/2}" fill="${color}"/>
</svg>`;

<Marker coordinate={...}>
  <Image
    source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}` }}
    style={{ width: size, height: size }}
  />
</Marker>
```

**Riesgo:** Android no soporta nativamente `data:image/svg+xml` en `Image`. Necesitaría una librería adicional como `react-native-svg-transformer` o `react-native-fast-image`.

---

## 5. Plan de Acción Recomendado

Orden de implementación sugerido (de menor a mayor esfuerzo):

### Fase 1 — Correcciones rápidas (1 hora)

1. **[Solución E]** Agregar `elevation: 0` explícito en `CircleMarker`
2. **[Solución C]** Agregar `renderToHardwareTextureAndroid` al View interno coloreado
3. Probar en Tecno Spark 10 Pro (el dispositivo más problemático)

### Fase 2 — Si la Fase 1 falla (2-3 horas)

4. **[Solución A]** Crear assets PNG para los 6 marcadores (96×96 px @3x) y usarlos con el prop `icon` de `<Marker>`. Este es el enfoque con mayor probabilidad de éxito.

### Fase 3 — Si se necesita color dinámico (1 día)

5. **[Solución B]** Implementar generación de PNG en runtime usando `react-native-view-shot` + caché en filesystem.

### No recomendado por ahora

6. **[Solución G]** Migrar a `@rnmapbox/maps` — demasiado costoso para un bug visual.

---

## 6. Archivos Relevantes

| Archivo | Rol |
|---------|-----|
| `src/components/map/markers.tsx` | **CENTRAL** — Componente base `CircleMarker` y 6 iconos exportados |
| `docs/BUG_MARKER_ICONOS_CUADRADOS.md` | Documentación del bug (desactualizada — describe v2) |
| `app/(passenger)/index.tsx` | Mapa pasajero — usa los 6 tipos de marker |
| `app/(driver)/index.tsx` | Mapa conductor inicio — usa `DriverTaxiIcon` |
| `app/(driver)/active-ride.tsx` | Mapa viaje activo conductor — 3 tipos de marker |
| `app/(driver)/manage-ride.tsx` | Mapa gestión de viaje — 2 tipos de marker |
| `app/(passenger)/delegated-ride-tracking.tsx` | Tracking viaje delegado — 3 tipos de marker |
| `components/stores/StoreMapView.tsx` | Marcadores de tiendas — tiene fix de shadow/clip separado |
| `components/SharedRideInvitationModal.tsx` | Modal invitación — usa `Marker` con `pinColor` (no custom) |
| `android/app/src/main/AndroidManifest.xml` | Sin flags GPU específicos |
| `app.config.js` | Config build — `compileSdkVersion: 35`, `minSdkVersion: 24` |

---

## 7. Notas para el Desarrollador

### Si se elige la Solución A (PNG assets):

Los PNGs deben generarse con las siguientes especificaciones:

| Marker | Tamaño canvas | Color fondo | Color borde | Icono | Tamaño icono |
|--------|--------------|-------------|-------------|-------|--------------|
| Taxi | 96×96 | `#1F2937` | `#FFFFFF` 3px | `local-taxi` blanco | 48px |
| Pasajero | 96×96 | `#FF8C00` | `#FFFFFF` 3px | `person` blanco | 48px |
| Recogida | 80×80 | `#FF8C00` | `#FFFFFF` 3px | `location` blanco | 40px |
| Destino | 80×80 | `#22c55e` | `#FFFFFF` 3px | `location` blanco | 40px |
| 2da Recogida | 72×72 | `#FF8C00` | `#FFFFFF` 3px | `person-add` blanco | 36px |
| 2do Destino | 72×72 | `#22c55e` | `#FFFFFF` 3px | `flag` blanco | 36px |

### Si se usa el prop `icon` en Marker:

```tsx
// Ejemplo con PNG local
<Marker
  coordinate={...}
  icon={require('../../assets/markers/taxi-marker.png')}
  anchor={{ x: 0.5, y: 0.5 }}
/>

// Ejemplo con URI (para imágenes generadas en runtime)
<Marker
  coordinate={...}
  icon={{ uri: cachedImagePath }}
  anchor={{ x: 0.5, y: 0.5 }}
/>
```

**Importante:** Al usar `icon`, NO se deben pasar hijos al `<Marker>`. El prop `icon` y los hijos son mutuamente excluyentes.

---

*Informe generado para referencia del equipo de desarrollo. Actualizar al implementar la solución definitiva.*
