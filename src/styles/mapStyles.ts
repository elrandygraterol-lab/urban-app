/**
 * Map Styles
 * 
 * Estilos personalizados para Mapbox GL Native
 * Incluye:
 * - Colores de UrbanTaxi
 * - Estilos de capas
 * - Temas (claro/oscuro)
 */

// Colores de UrbanTaxi
export const COLORS = {
  primary: '#22c55e', // Verde
  secondary: '#FF9500', // Naranja
  accent: '#0066CC', // Azul
  background: '#FFFFFF',
  text: '#333333',
  textLight: '#666666',
  border: '#EEEEEE',
  error: '#FF0000',
  success: '#22c55e',
  warning: '#FF9500',
};

// Estilos de líneas
export const lineStyles = {
  route: {
    lineColor: COLORS.primary,
    lineWidth: 4,
    lineOpacity: 0.8,
  },
  routeAlternative: {
    lineColor: COLORS.textLight,
    lineWidth: 2,
    lineOpacity: 0.5,
    lineDasharray: [2, 2],
  },
  highlight: {
    lineColor: COLORS.secondary,
    lineWidth: 6,
    lineOpacity: 0.9,
  },
};

// Estilos de puntos
export const pointStyles = {
  pickup: {
    circleRadius: 8,
    circleColor: COLORS.primary,
    circleStrokeWidth: 2,
    circleStrokeColor: COLORS.background,
  },
  dropoff: {
    circleRadius: 8,
    circleColor: COLORS.secondary,
    circleStrokeWidth: 2,
    circleStrokeColor: COLORS.background,
  },
  driver: {
    circleRadius: 8,
    circleColor: COLORS.accent,
    circleStrokeWidth: 2,
    circleStrokeColor: COLORS.background,
  },
  nearby: {
    circleRadius: 6,
    circleColor: COLORS.textLight,
    circleStrokeWidth: 1,
    circleStrokeColor: COLORS.background,
  },
};

// Estilos de texto
export const textStyles = {
  label: {
    textSize: 12,
    textColor: COLORS.text,
    textHaloColor: COLORS.background,
    textHaloWidth: 1,
  },
  labelLarge: {
    textSize: 14,
    textColor: COLORS.text,
    textHaloColor: COLORS.background,
    textHaloWidth: 1,
  },
};

// Tema claro
export const lightTheme = {
  backgroundColor: COLORS.background,
  textColor: COLORS.text,
  borderColor: COLORS.border,
  lineColor: COLORS.primary,
};

// Tema oscuro
export const darkTheme = {
  backgroundColor: '#1A1A1A',
  textColor: '#FFFFFF',
  borderColor: '#333333',
  lineColor: COLORS.primary,
};

// Estilos de capas personalizadas
export const layerStyles = {
  // Capa de rutas
  routeLayer: {
    id: 'route-layer',
    type: 'line',
    paint: {
      'line-color': COLORS.primary,
      'line-width': 4,
      'line-opacity': 0.8,
    },
  },

  // Capa de puntos de pickup
  pickupLayer: {
    id: 'pickup-layer',
    type: 'circle',
    paint: {
      'circle-radius': 8,
      'circle-color': COLORS.primary,
      'circle-stroke-width': 2,
      'circle-stroke-color': COLORS.background,
    },
  },

  // Capa de puntos de dropoff
  dropoffLayer: {
    id: 'dropoff-layer',
    type: 'circle',
    paint: {
      'circle-radius': 8,
      'circle-color': COLORS.secondary,
      'circle-stroke-width': 2,
      'circle-stroke-color': COLORS.background,
    },
  },

  // Capa de conductores
  driverLayer: {
    id: 'driver-layer',
    type: 'circle',
    paint: {
      'circle-radius': 8,
      'circle-color': COLORS.accent,
      'circle-stroke-width': 2,
      'circle-stroke-color': COLORS.background,
    },
  },

  // Capa de conductores cercanos
  nearbyDriversLayer: {
    id: 'nearby-drivers-layer',
    type: 'circle',
    paint: {
      'circle-radius': 6,
      'circle-color': COLORS.textLight,
      'circle-stroke-width': 1,
      'circle-stroke-color': COLORS.background,
    },
  },
};

// Configuración de zoom
export const zoomLevels = {
  world: 1,
  country: 4,
  city: 10,
  street: 15,
  building: 18,
  default: 15,
};

// Configuración de animación
export const animationConfig = {
  duration: 1000, // ms
  easing: 'ease-in-out',
};

// Configuración de cámara
export const cameraConfig = {
  pitch: 0,
  bearing: 0,
  zoomLevel: zoomLevels.default,
  animationDuration: animationConfig.duration,
};

// Configuración de marcadores
export const markerConfig = {
  size: 40,
  borderWidth: 3,
  borderColor: COLORS.background,
};

// Configuración de rutas
export const routeConfig = {
  lineWidth: 4,
  lineOpacity: 0.8,
  lineCap: 'round',
  lineJoin: 'round',
};

// Configuración de offline
export const offlineConfig = {
  tileCachePath: 'mapbox-offline-tiles',
  maxCacheSize: 500 * 1024 * 1024, // 500MB
  cacheTTL: 7 * 24 * 60 * 60 * 1000, // 7 días
};

// Función para obtener tema basado en preferencia
export const getTheme = (isDarkMode: boolean) => {
  return isDarkMode ? darkTheme : lightTheme;
};

// Función para obtener color basado en tipo de marcador
export const getMarkerColor = (type: 'pickup' | 'dropoff' | 'driver' | 'nearby') => {
  switch (type) {
    case 'pickup':
      return COLORS.primary;
    case 'dropoff':
      return COLORS.secondary;
    case 'driver':
      return COLORS.accent;
    case 'nearby':
      return COLORS.textLight;
    default:
      return COLORS.primary;
  }
};

// Función para obtener estilo de línea basado en tipo
export const getLineStyle = (type: 'route' | 'alternative' | 'highlight') => {
  switch (type) {
    case 'route':
      return lineStyles.route;
    case 'alternative':
      return lineStyles.routeAlternative;
    case 'highlight':
      return lineStyles.highlight;
    default:
      return lineStyles.route;
  }
};

export default {
  COLORS,
  lineStyles,
  pointStyles,
  textStyles,
  lightTheme,
  darkTheme,
  layerStyles,
  zoomLevels,
  animationConfig,
  cameraConfig,
  markerConfig,
  routeConfig,
  offlineConfig,
  getTheme,
  getMarkerColor,
  getLineStyle,
};
