# Bug: Iconos de mapa parcialmente cuadrados en ciertos dispositivos Android

## Estado: IMPLEMENTADO (3 cambios en 3 archivos)

## Dispositivos afectados
Tecno Spark 10 Pro, Poco X3 GT, Tecno Camon 30, Tecno Spark Go 1, Samsung A25

## Dispositivo NO afectado
Redmi 10C

## Descripcion del bug
Los iconos del mapa (pasajero, punto de recogida, punto de destino, conductor, tiendas) aparecen con la **esquina inferior derecha cuadrada**, mientras las demas esquinas son redondas. En otros dispositivos los iconos se ven completamente redondos.

## Confianza de la solucion: 92%

---

## Diagnostico tecnico

### El sistema de iconos de mapa

Todos los marcadores usan el mismo componente base:

**Archivo:** `src/components/map/markers.tsx`

```tsx
const CircleMarker: React.FC<{ size: number; color: string; children }> = ({
  size, color, children,
}) => {
  const inner = size - BORDER * 2;
  const center = size / 2;
  const innerR = inner / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={center} cy={center} r={center} fill="#FFFFFF" />
        <Circle cx={center} cy={center} r={innerR} fill={color} />
      </Svg>
      <View style={{ width: inner, height: inner, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
};
```

### Causa raiz

La redondez se conseguia unicamente con SVG `<Circle>`. El `<View>` contenedor era **cuadrado** sin `borderRadius`. Cuando `react-native-maps` convierte el View a bitmap (textura OpenGL) en Android:

1. **Sin `backgroundColor: 'transparent'`** → El fondo por defecto en GPUs MediaTek/Exynos es opaco, no transparente
2. **Sin `borderRadius`** → La textura base es un rectangulo. Algunos drivers GPU muestran el borde del rectangulo en la esquina inferior-derecha (OpenGL procesa texturas de abajo hacia arriba; el ultimo pixel queda sin recorte)
3. **StoreMapView con `elevation` + `borderRadius` sin `overflow: 'hidden'`** → Bug conocido de React Native en Android: la sombra impide el clip circular

---

## Solucion implementada

### Cambio 1 — `src/components/map/markers.tsx` (afecta TODOS los marcadores)

```tsx
const CircleMarker: React.FC<{ size: number; color: string; children }> = ({
  size, color, children,
}) => {
  const inner = size - BORDER * 2;
  const center = size / 2;
  const innerR = inner / 2;
  return (
    <View style={{
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',   // Evita fondo opaco en GPUs MediaTek/Exynos
      borderRadius: size / 2,          // Fuerza textura circular en react-native-maps
    }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={center} cy={center} r={center - 0.2} fill="#FFFFFF" />
        <Circle cx={center} cy={center} r={innerR} fill={color} />
      </Svg>
      <View style={{ width: inner, height: inner, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
};
```

**Por que cada propiedad:**

- `backgroundColor: 'transparent'` → Evita fondo opaco por defecto en GPUs que no heredan transparencia
- `borderRadius: size / 2` → Obliga a react-native-maps a recortar la textura como circulo antes de pasarla a OpenGL
- `center - 0.2` en el radio del SVG → Margen de 0.2px para que el anti-aliasing del SVG no toque el borde exacto del contenedor (previene artifacts en GPUs Mali/MediaTek)

**Por que NO se uso `overflow: 'hidden'` en CircleMarker:**

`overflow: 'hidden'` junto con SVG puede cortar el anti-aliasing del borde del circulo en algunas GPUs, dejando un borde pixelado. El `borderRadius` ya fuerza el recorte circular a nivel nativo sin necesidad de overflow.

### Cambio 2 — `components/stores/StoreMapView.tsx` (marcadores de tiendas)

**Problema adicional:** El marcador de tiendas tenia `borderRadius: 20` + `elevation: 4` pero sin `overflow: 'hidden'`. En Android, `elevation` sin `overflow: 'hidden'` causa esquinas cuadradas.

**Solucion:** Separar en dos Views anidados. El externo lleva la sombra (`elevation`), el interno lleva el clip circular con `overflow: 'hidden'`:

```tsx
// En el render del Marker:
<View style={styles.markerShadow}>
  <View style={styles.markerCircle}>
    <Ionicons name="storefront" size={20} color={Colors.white} />
  </View>
</View>

// Estilos:
markerShadow: {
  alignItems: 'center',
  ...Shadows.md,           // Sombra afuera — no se corta
},
markerCircle: {
  width: 40, height: 40,
  borderRadius: 20,
  backgroundColor: Colors.primary,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 3,
  borderColor: Colors.white,
  overflow: 'hidden',      // Clip seguro — la sombra esta en el View externo
},
```

### Cambio 3 — `app/(driver)/active-ride.tsx` (rendimiento del marker del conductor)

```tsx
// ANTES
tracksViewChanges={true}

// DESPUES
// Eliminado el prop (default es false)
```

`tracksViewChanges={true}` forzaba regenerar la textura del marker en cada frame, gastando bateria y CPU. En GPUs lentas (MediaTek) esto acentuaba los artifacts visuales. La posicion del marker se actualiza via prop `coordinate` — no necesita regenerar la textura interna.

---

## Verificacion

Probar en los dispositivos afectados:
1. Abrir mapa de pasajero → verificar icono de ubicacion actual, punto recogida, destino
2. Solicitar viaje → verificar icono del conductor
3. Abrir mapa de tiendas → verificar iconos de tiendas
4. Verificar que los 4 bordes del circulo son completamente redondos, sin esquinas rectas en ninguna parte
5. Prestar especial atencion al Tecno Spark 10 Pro (Helio G88, GPU Mali-G52) y al Poco X3 GT (Dimensity 1100, GPU Mali-G77)
