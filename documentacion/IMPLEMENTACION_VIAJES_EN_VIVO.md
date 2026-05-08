# Implementación: Viajes en Vivo con Mapa en Tiempo Real

## Descripción

Se ha implementado una sección completa de "Viajes en Vivo" en el panel de administración que permite monitorear en tiempo real la ubicación de todos los conductores activos mediante un mapa interactivo con Leaflet.

## Características Implementadas

### 1. Mapa Interactivo con Leaflet
- Mapa de OpenStreetMap integrado
- Marcadores personalizados para conductores
- Popups informativos al hacer clic en cada conductor
- Control de escala y zoom
- Centrado automático basado en ubicaciones de conductores

### 2. Estadísticas en Tiempo Real
- **Conductores Activos**: Total de conductores con ubicación activa
- **Viajes en Curso**: Número de viajes actualmente en progreso
- **Conductores Ocupados**: Conductores que tienen un viaje activo
- **Conductores Disponibles**: Conductores libres para aceptar viajes

### 3. Sistema de Filtros
- **Búsqueda por texto**: Buscar conductores por nombre o placa
- **Tipo de vehículo**: Filtrar por Taxi o Moto-Taxi
- **Estado**: Filtrar por disponible u ocupado
- Botones para aplicar y limpiar filtros

### 4. Lista de Conductores Activos
- Lista lateral con todos los conductores activos
- Indicador visual de estado (disponible/ocupado)
- Click para enfocar conductor en el mapa
- Scroll para ver todos los conductores

### 5. Actualización Automática
- Actualización cada 10 segundos por defecto
- Toggle para activar/desactivar actualización automática
- Indicador de última actualización

### 6. Marcadores Diferenciados
- **Verde**: Conductor disponible
- **Naranja**: Conductor ocupado (con viaje activo)
- Iconos de vehículo en los marcadores

## Archivos Creados/Modificados

### Nuevos Archivos

1. **backend/views/admin/live-rides.ejs**
   - Vista principal con mapa de Leaflet
   - Interfaz de filtros y estadísticas
   - JavaScript para manejo del mapa y actualización en tiempo real

### Archivos Modificados

1. **backend/src/routes/adminRoutes.ts**
   - Agregada ruta: `GET /api/admin/drivers/active-locations`

2. **backend/src/controllers/adminController.ts**
   - Agregado método: `getActiveDriverLocations()`

3. **backend/src/services/adminService.ts**
   - Agregado método: `getActiveDriverLocations()`
   - Retorna conductores activos con sus ubicaciones y estado

4. **backend/src/controllers/adminWebController.ts**
   - Actualizado método: `getRidesPage()` para usar la nueva vista

## Endpoint API

### GET /api/admin/drivers/active-locations

Obtiene la ubicación en tiempo real de todos los conductores activos.

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "driver-id",
      "userId": "user-id",
      "name": "Nombre del Conductor",
      "email": "email@example.com",
      "phone": "04121234567",
      "vehicleType": "taxi",
      "licensePlate": "ABC123",
      "vehicleModel": "Toyota Corolla",
      "vehicleColor": "Blanco",
      "vehicleYear": 2020,
      "isAvailable": true,
      "currentLatitude": 10.4806,
      "currentLongitude": -66.9036,
      "lastLocationUpdate": "2026-03-24T10:30:00.000Z",
      "hasActiveRide": false,
      "averageRating": 4.5,
      "totalRides": 150
    }
  ]
}
```

## Flujo de Funcionamiento

1. **Carga Inicial**:
   - Se inicializa el mapa centrado en Caracas, Venezuela
   - Se cargan los conductores activos desde el API
   - Se muestran las estadísticas y marcadores en el mapa

2. **Actualización Automática**:
   - Cada 10 segundos se consulta el endpoint
   - Se actualizan las estadísticas
   - Se actualizan los marcadores en el mapa
   - Se actualiza la lista de conductores

3. **Filtros**:
   - El usuario puede buscar por nombre o placa
   - Puede filtrar por tipo de vehículo
   - Puede filtrar por estado (disponible/ocupado)
   - Al aplicar filtros, solo se muestran los conductores que coinciden

4. **Interacción**:
   - Click en marcador: Muestra popup con información del conductor
   - Click en conductor de la lista: Enfoca el mapa en ese conductor
   - Botón "Centrar": Ajusta el mapa para mostrar todos los conductores

## Estado Actual

### Funcional
✅ Mapa interactivo con Leaflet
✅ Endpoint API para obtener ubicaciones
✅ Estadísticas en tiempo real
✅ Sistema de filtros
✅ Lista de conductores activos
✅ Actualización automática
✅ Marcadores diferenciados por estado

### Pendiente (Requiere Datos Reales)
⏳ Ubicaciones reales de conductores (actualmente ningún conductor tiene ubicación activa)
⏳ Integración con WebSocket para actualizaciones en tiempo real sin polling
⏳ Mostrar rutas de viajes activos en el mapa
⏳ Historial de ubicaciones de conductores

## Notas Importantes

1. **Sin Conductores Activos**: Si no hay conductores con ubicación activa, el mapa se mostrará vacío con un mensaje indicando que no hay conductores activos.

2. **Ubicación de Conductores**: Los conductores deben actualizar su ubicación desde la app móvil para aparecer en el mapa. Los campos `currentLatitude`, `currentLongitude` y `lastLocationUpdate` del modelo `DriverProfile` deben estar poblados.

3. **Rendimiento**: La actualización cada 10 segundos es adecuada para un número moderado de conductores. Para escalar, se recomienda implementar WebSocket.

4. **Seguridad**: El endpoint está protegido con autenticación y autorización de admin.

## Próximos Pasos Recomendados

1. Implementar actualización de ubicación desde la app móvil del conductor
2. Agregar WebSocket para actualizaciones en tiempo real
3. Mostrar rutas de viajes activos en el mapa
4. Agregar filtro por zona geográfica
5. Implementar heatmap de demanda de viajes
6. Agregar notificaciones de eventos importantes (conductor offline, viaje completado, etc.)
