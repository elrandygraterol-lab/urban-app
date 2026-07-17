/**
 * Fallback places for client-side search when backend API is unavailable.
 * Only the most common streets, neighborhoods, and landmarks in San Juan de los Morros.
 */

export interface FallbackPlace {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  type: string;
  fullAddress: string;
  source: 'custom';
}

const places: FallbackPlace[] = [
  // Main Avenues
  { id: 'fb-av-bolivar', name: 'Avenida Bolívar', description: 'Av. Bolívar, San Juan de los Morros, Guárico', latitude: 9.9125, longitude: -67.3548, type: 'other', fullAddress: 'Av. Bolívar, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-av-roscio', name: 'Avenida Juan Germán Roscio', description: 'Av. Juan Germán Roscio, San Juan de los Morros, Guárico', latitude: 9.9092, longitude: -67.3530, type: 'other', fullAddress: 'Av. Juan Germán Roscio, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-av-miranda', name: 'Avenida Miranda', description: 'Av. Miranda, San Juan de los Morros, Guárico', latitude: 9.9110, longitude: -67.3560, type: 'other', fullAddress: 'Av. Miranda, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-av-ribas', name: 'Avenida José Félix Ribas', description: 'Av. José Félix Ribas, San Juan de los Morros, Guárico', latitude: 9.9140, longitude: -67.3520, type: 'other', fullAddress: 'Av. José Félix Ribas, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-av-intercomunal', name: 'Avenida Intercomunal', description: 'Av. Intercomunal, San Juan de los Morros, Guárico', latitude: 9.9080, longitude: -67.3580, type: 'other', fullAddress: 'Av. Intercomunal, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-av-morros', name: 'Avenida Los Morros', description: 'Av. Los Morros, San Juan de los Morros, Guárico', latitude: 9.9150, longitude: -67.3500, type: 'other', fullAddress: 'Av. Los Morros, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-av-libertador', name: 'Avenida Libertador', description: 'Av. Libertador, San Juan de los Morros, Guárico', latitude: 9.9100, longitude: -67.3570, type: 'other', fullAddress: 'Av. Libertador, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-av-universitaria', name: 'Avenida Universitaria', description: 'Av. Universitaria, San Juan de los Morros, Guárico', latitude: 9.9085, longitude: -67.3480, type: 'other', fullAddress: 'Av. Universitaria, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-av-romulo', name: 'Avenida Rómulo Gallegos', description: 'Av. Rómulo Gallegos, San Juan de los Morros, Guárico', latitude: 9.9130, longitude: -67.3555, type: 'other', fullAddress: 'Av. Rómulo Gallegos, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-av-fuerzas', name: 'Avenida Fuerzas Armadas', description: 'Av. Fuerzas Armadas, San Juan de los Morros, Guárico', latitude: 9.9115, longitude: -67.3520, type: 'other', fullAddress: 'Av. Fuerzas Armadas, San Juan de los Morros, Guárico', source: 'custom' },

  // Main Streets
  { id: 'fb-calle-real', name: 'Calle Real', description: 'Calle Real, San Juan de los Morros, Guárico', latitude: 9.9115, longitude: -67.3530, type: 'other', fullAddress: 'Calle Real, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-calle-comercio', name: 'Calle Comercio', description: 'Calle Comercio, San Juan de los Morros, Guárico', latitude: 9.9118, longitude: -67.3545, type: 'other', fullAddress: 'Calle Comercio, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-calle-paez', name: 'Calle Páez', description: 'Calle Páez, San Juan de los Morros, Guárico', latitude: 9.9122, longitude: -67.3550, type: 'other', fullAddress: 'Calle Páez, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-calle-carabobo', name: 'Calle Carabobo', description: 'Calle Carabobo, San Juan de los Morros, Guárico', latitude: 9.9120, longitude: -67.3535, type: 'other', fullAddress: 'Calle Carabobo, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-calle-sucre', name: 'Calle Sucre', description: 'Calle Sucre, San Juan de los Morros, Guárico', latitude: 9.9112, longitude: -67.3540, type: 'other', fullAddress: 'Calle Sucre, San Juan de los Morros, Guárico', source: 'custom' },

  // Neighborhoods
  { id: 'fb-urb-recreo', name: 'Urbanización El Recreo', description: 'Urb. El Recreo, San Juan de los Morros, Guárico', latitude: 9.9160, longitude: -67.3480, type: 'other', fullAddress: 'Urb. El Recreo, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-urb-acacias', name: 'Urbanización Las Acacias', description: 'Urb. Las Acacias, San Juan de los Morros, Guárico', latitude: 9.9145, longitude: -67.3600, type: 'other', fullAddress: 'Urb. Las Acacias, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-urb-angeles', name: 'Urbanización Los Ángeles', description: 'Urb. Los Ángeles, San Juan de los Morros, Guárico', latitude: 9.9180, longitude: -67.3520, type: 'other', fullAddress: 'Urb. Los Ángeles, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-urb-san-antonio', name: 'Urbanización San Antonio', description: 'Urb. San Antonio, San Juan de los Morros, Guárico', latitude: 9.9070, longitude: -67.3590, type: 'other', fullAddress: 'Urb. San Antonio, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-urb-rosales', name: 'Urbanización Los Rosales', description: 'Urb. Los Rosales, San Juan de los Morros, Guárico', latitude: 9.9200, longitude: -67.3550, type: 'other', fullAddress: 'Urb. Los Rosales, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-urb-barbara', name: 'Urbanización Doña Bárbara', description: 'Urb. Doña Bárbara, San Juan de los Morros, Guárico', latitude: 9.9100, longitude: -67.3590, type: 'other', fullAddress: 'Urb. Doña Bárbara, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-urb-san-miguel', name: 'Urbanización San Miguel', description: 'Urb. San Miguel, San Juan de los Morros, Guárico', latitude: 9.9170, longitude: -67.3540, type: 'other', fullAddress: 'Urb. San Miguel, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-br-obero', name: 'Barrio Obrero', description: 'Barrio Obrero, San Juan de los Morros, Guárico', latitude: 9.9130, longitude: -67.3580, type: 'other', fullAddress: 'Barrio Obrero, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-br-san-jose', name: 'Barrio San José', description: 'Barrio San José, San Juan de los Morros, Guárico', latitude: 9.9080, longitude: -67.3520, type: 'other', fullAddress: 'Barrio San José, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-urb-morera', name: 'Urbanización La Morera', description: 'Urb. La Morera, San Juan de los Morros, Guárico', latitude: 9.9095, longitude: -67.3620, type: 'other', fullAddress: 'Urb. La Morera, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-br-carmen', name: 'Barrio El Carmen', description: 'Barrio El Carmen, San Juan de los Morros, Guárico', latitude: 9.9160, longitude: -67.3570, type: 'other', fullAddress: 'Barrio El Carmen, San Juan de los Morros, Guárico', source: 'custom' },

  // Landmarks
  { id: 'fb-plaza-bolivar', name: 'Plaza Bolívar', description: 'Plaza Bolívar, San Juan de los Morros, Guárico', latitude: 9.9110, longitude: -67.3535, type: 'landmark', fullAddress: 'Plaza Bolívar, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-catedral', name: 'Catedral San Juan Bautista', description: 'Catedral San Juan Bautista, San Juan de los Morros, Guárico', latitude: 9.9118, longitude: -67.3528, type: 'landmark', fullAddress: 'Catedral San Juan Bautista, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-uc-guarico', name: 'UNERG - Universidad Nacional Experimental Rómulo Gallegos', description: 'UNERG, San Juan de los Morros, Guárico', latitude: 9.9075, longitude: -67.3465, type: 'landmark', fullAddress: 'UNERG, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-hospital', name: 'Hospital General de San Juan (Hospital Central)', description: 'Av. Juan Germán Roscio, San Juan de los Morros, Guárico', latitude: 9.9075, longitude: -67.3550, type: 'landmark', fullAddress: 'Av. Juan Germán Roscio, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-morros', name: 'Los Morros de San Juan', description: 'Monumento Natural Los Morros, San Juan de los Morros, Guárico', latitude: 9.9000, longitude: -67.3650, type: 'landmark', fullAddress: 'Los Morros de San Juan, Guárico', source: 'custom' },
  { id: 'fb-terminal', name: 'Terminal de Pasajeros San Juan', description: 'Av. Intercomunal, San Juan de los Morros, Guárico', latitude: 9.9080, longitude: -67.3610, type: 'landmark', fullAddress: 'Av. Intercomunal, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-mercado', name: 'Mercado Municipal de San Juan (Churuata)', description: 'Calle Carabobo, San Juan de los Morros, Guárico', latitude: 9.9120, longitude: -67.3590, type: 'landmark', fullAddress: 'Calle Carabobo, San Juan de los Morros, Guárico', source: 'custom' },

  // Other Areas
  { id: 'fb-zona-industrial', name: 'Zona Industrial', description: 'Zona Industrial, San Juan de los Morros, Guárico', latitude: 9.9030, longitude: -67.3500, type: 'other', fullAddress: 'Zona Industrial, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-centro', name: 'Centro de San Juan', description: 'Centro, San Juan de los Morros, Guárico', latitude: 9.9110, longitude: -67.3540, type: 'other', fullAddress: 'Centro, San Juan de los Morros, Guárico', source: 'custom' },
  { id: 'fb-san-juan-nombre', name: 'San Juan de los Morros', description: 'San Juan de los Morros, Estado Guárico, Venezuela', latitude: 9.9107, longitude: -67.3536, type: 'other', fullAddress: 'San Juan de los Morros, Estado Guárico, Venezuela', source: 'custom' },
  { id: 'fb-guarico', name: 'Estado Guárico', description: 'Estado Guárico, Venezuela', latitude: 8.7000, longitude: -66.6000, type: 'other', fullAddress: 'Estado Guárico, Venezuela', source: 'custom' },
];

export function searchFallbackPlaces(query: string, limit: number = 5): FallbackPlace[] {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();
  return places
    .filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    )
    .slice(0, limit);
}
