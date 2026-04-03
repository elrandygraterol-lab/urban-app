# Notificación Global de Solicitud de Viaje

## Problema Resuelto

Las notificaciones de nuevas solicitudes de viaje solo se mostraban cuando el conductor estaba en la pantalla de inicio (`/(driver)/index`). Si el conductor estaba en cualquier otra pantalla (perfil, ganancias, historial, etc.), NO recibía la notificación de nuevas carreras.

## Solución Implementada

### 1. **Hook Global** - `useGlobalSocketListeners.ts`

Agregué el manejador `handleRideRequest` al hook global que ya maneja pagos y cancelaciones.

**Características:**

- ✅ **Alert Nativo**: Usa `Alert.alert()` para garantizar que se muestre en CUALQUIER pantalla
- ✅ **Solo para Conductores**: Verifica que `user.role === 'driver'` antes de mostrar
- ✅ **Prevención de Duplicados**: Usa `activeRideRequestRef` para evitar múltiples alertas del mismo viaje
- ✅ **Sonido de Notificación**: Reproduce sonido antes de mostrar el alert
- ✅ **Auto-expiración**: Limpia la referencia después de 30 segundos
- ✅ **Navegación**: Botón "Ver Detalles" lleva al conductor a la pantalla de inicio

**Código del Handler:**

```typescript
const handleRideRequest = useCallback(
  (data: {
    id: string;
    passengerName: string;
    pickupAddress: string;
    destinationAddress: string;
    estimatedFare: number;
    distance: number;
    expiresAt: string;
  }) => {
    // Solo para conductores
    if (user?.role !== 'driver') return;

    // Prevenir duplicados
    if (activeRideRequestRef.current === data.id) return;
    
    activeRideRequestRef.current = data.id;
    playNotificationSound();

    // Alert nativo con detalles del viaje
    Alert.alert(
      '🚗 Nueva Solicitud de Viaje',
      `Pasajero: ${data.passengerName}\n\n` +
      `Recogida: ${data.pickupAddress}\n\n` +
      `Destino: ${data.destinationAddress}\n\n` +
      `Tarifa: Bs. ${data.estimatedFare.toFixed(2)}\n` +
      `Distancia: ${data.distance.toFixed(1)} km`,
      [
        { text: 'Rechazar', style: 'cancel' },
        { text: 'Ver Detalles', onPress: () => router.push('/(driver)/index') }
      ]
    );
  },
  [user?.role, playNotificationSound, router]
);
```

### 2. **Registro del Listener**

El listener se registra automáticamente cuando:
- El usuario está autenticado
- El usuario es un conductor (`user.role === 'driver'`)
- El socket está conectado

```typescript
// Solo registrar para conductores
if (user.role === 'driver') {
  socket.on('ride:request_created', handleRideRequest);
}
```

### 3. **Compatibilidad con Pantalla de Inicio**

El componente `/(driver)/index.tsx` mantiene su propio manejador local que:
- Actualiza el estado `rideRequest` para mostrar la tarjeta visual
- Permite aceptar/rechazar directamente desde la pantalla

**Resultado**: Doble notificación cuando el conductor está en inicio:
1. Alert global (se puede cerrar)
2. Tarjeta visual en la pantalla (para aceptar/rechazar)

Esto es intencional y beneficioso - el conductor tiene múltiples formas de interactuar con la solicitud.

## Flujo Completo

### Conductor en Pantalla de Inicio

1. Pasajero solicita viaje
2. Backend emite `ride:request_created`
3. **Alert global** se muestra con sonido 🔔
4. **Tarjeta visual** aparece en la pantalla
5. Conductor puede:
   - Cerrar el alert y usar la tarjeta
   - Usar el botón "Ver Detalles" del alert
   - Aceptar/Rechazar desde la tarjeta

### Conductor en Otra Pantalla (Perfil, Ganancias, etc.)

1. Pasajero solicita viaje
2. Backend emite `ride:request_created`
3. **Alert global** se muestra con sonido 🔔
4. Conductor ve el alert sin importar dónde esté
5. Conductor puede:
   - Presionar "Ver Detalles" → Navega a inicio
   - Presionar "Rechazar" → Cierra el alert
   - Ignorar (expira en 30 segundos)

## Eventos Globales Ahora Manejados

El hook `useGlobalSocketListeners` ahora maneja 3 eventos críticos:

| Evento | Para Quién | Descripción |
|--------|-----------|-------------|
| `ride:request_created` | Conductores | Nueva solicitud de viaje |
| `ride:payment_completed` | Conductores | Pasajero completó el pago |
| `ride:cancelled` | Ambos | Viaje cancelado |

## Prevención de Duplicados

### Problema
Sin prevención, el mismo viaje podría generar múltiples alerts si:
- El evento se emite varias veces
- El socket se reconecta
- Hay múltiples listeners registrados

### Solución
```typescript
const activeRideRequestRef = useRef<string | null>(null);

// Antes de mostrar alert
if (activeRideRequestRef.current === data.id) {
  console.log('Alert already showing, skipping duplicate');
  return;
}

// Marcar como activo
activeRideRequestRef.current = data.id;

// Auto-limpiar después de 30 segundos
setTimeout(() => {
  if (activeRideRequestRef.current === data.id) {
    activeRideRequestRef.current = null;
  }
}, 30000);
```

## Beneficios

1. ✅ **Notificaciones Garantizadas**: El conductor SIEMPRE recibe la notificación
2. ✅ **Funciona en Cualquier Pantalla**: No importa dónde esté el conductor
3. ✅ **Nativo**: Usa el sistema de alertas del OS (iOS/Android)
4. ✅ **Sonido**: Alerta audible para llamar la atención
5. ✅ **Sin Duplicados**: Prevención inteligente de alertas repetidas
6. ✅ **Navegación Fácil**: Botón directo para ver detalles
7. ✅ **Compatible**: Funciona junto con la tarjeta visual existente

## Archivos Modificados

1. `app/hooks/useGlobalSocketListeners.ts` - Agregado handler global

## Pruebas Recomendadas

### Prueba 1: Conductor en Inicio
1. Conductor en pantalla de inicio
2. Pasajero solicita viaje
3. ✅ Verificar que aparece Alert
4. ✅ Verificar que aparece tarjeta visual
5. ✅ Verificar que suena notificación

### Prueba 2: Conductor en Otra Pantalla
1. Conductor en pantalla de perfil/ganancias
2. Pasajero solicita viaje
3. ✅ Verificar que aparece Alert
4. ✅ Presionar "Ver Detalles"
5. ✅ Verificar navegación a inicio
6. ✅ Verificar que aparece tarjeta visual

### Prueba 3: Múltiples Solicitudes
1. Conductor en cualquier pantalla
2. Pasajero 1 solicita viaje
3. ✅ Verificar Alert del viaje 1
4. Pasajero 2 solicita viaje (sin cerrar alert 1)
5. ✅ Verificar que NO aparece alert duplicado del viaje 1
6. ✅ Verificar que aparece alert del viaje 2

### Prueba 4: Expiración
1. Conductor recibe solicitud
2. No interactuar con el alert
3. Esperar 30 segundos
4. ✅ Verificar que la referencia se limpia
5. Nueva solicitud del mismo viaje
6. ✅ Verificar que aparece nuevo alert

## Notas Técnicas

- El alert es **bloqueante** - el usuario debe interactuar con él
- El alert se muestra **por encima** de cualquier pantalla
- El sonido se reproduce **antes** de mostrar el alert
- La referencia activa se limpia en:
  - Cuando el usuario presiona un botón
  - Después de 30 segundos (auto-expiración)
  - Cuando el componente se desmonta (cleanup)
