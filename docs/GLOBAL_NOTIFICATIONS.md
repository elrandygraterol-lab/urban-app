# Sistema de Notificaciones Globales

## Descripción

El sistema de notificaciones globales permite mostrar notificaciones in-app en cualquier pantalla de la aplicación, sin importar en qué sección se encuentre el usuario.

## Arquitectura

### Componentes Principales

1. **`notificationStore.ts`** - Store de Zustand que maneja el estado global de las notificaciones
2. **`GlobalNotificationModal.tsx`** - Componente modal que se renderiza a nivel de aplicación
3. **`_layout.tsx`** - Layout principal donde se monta el componente global

## Uso

### 1. Importar el Store

```typescript
import { useNotificationStore } from '@/store/notificationStore';
```

### 2. Obtener la Función para Agregar Notificaciones

```typescript
const { addNotification } = useNotificationStore();
```

### 3. Mostrar una Notificación

```typescript
addNotification({
  type: 'payment_completed', // Tipo de notificación
  title: '¡Pago Recibido!',
  message: 'El pasajero ha completado el pago del viaje.',
  data: {
    /* datos adicionales */
  },
  actionLabel: 'Ver Detalles', // Opcional
  onAction: () => {
    // Acción al presionar el botón
    router.push('/earnings');
  },
});
```

## Tipos de Notificaciones

El sistema soporta los siguientes tipos de notificaciones, cada uno con su propio estilo visual:

- `ride_request` - Solicitud de viaje (verde)
- `ride_accepted` - Viaje aceptado (verde)
- `ride_cancelled` - Viaje cancelado (rojo)
- `payment_completed` - Pago completado (verde)
- `driver_arrived` - Conductor llegó (naranja)
- `ride_started` - Viaje iniciado (azul)
- `ride_completed` - Viaje completado (verde)
- `success` - Éxito general (verde)
- `warning` - Advertencia (naranja)
- `error` - Error (rojo)
- `info` - Información (azul)

## Características

### Auto-Dismiss

Las notificaciones se cierran automáticamente después de 5 segundos.

### Animación

Las notificaciones se deslizan desde la parte superior con una animación suave.

### Botón de Acción

Puedes agregar un botón de acción opcional que ejecute una función cuando se presione.

### Diseño Responsivo

El modal se adapta al tamaño de la pantalla y respeta las áreas seguras del dispositivo.

## Ejemplos de Uso

### Notificación Simple

```typescript
addNotification({
  type: 'success',
  title: 'Operación Exitosa',
  message: 'La operación se completó correctamente.',
});
```

### Notificación con Acción

```typescript
addNotification({
  type: 'ride_request',
  title: 'Nueva Solicitud de Viaje',
  message: 'Un pasajero está solicitando un viaje cerca de ti.',
  actionLabel: 'Ver Detalles',
  onAction: () => {
    router.push('/ride-details');
  },
});
```

### Notificación con Datos Personalizados

```typescript
addNotification({
  type: 'payment_completed',
  title: '¡Pago Recibido!',
  message: `Ganaste Bs. ${earnings.toFixed(2)}`,
  data: {
    rideId: '123',
    amount: 50.0,
    earnings: 45.0,
  },
  actionLabel: 'Ver Ganancias',
  onAction: () => {
    router.push('/earnings');
  },
});
```

## Integración con WebSocket

El sistema está integrado con los eventos de WebSocket para mostrar notificaciones automáticamente:

```typescript
socket.on('ride:payment_completed', data => {
  addNotification({
    type: 'payment_completed',
    title: '¡Pago Recibido!',
    message: `Ganaste Bs. ${data.driverEarnings.toFixed(2)}`,
    data: data,
    actionLabel: 'Ver Detalles',
    onAction: () => {
      router.push('/(driver)/earnings');
    },
  });
});
```

## Ventajas

1. **Global** - Aparece en todas las pantallas de la app
2. **Consistente** - Diseño uniforme en toda la aplicación
3. **No Bloqueante** - No interrumpe la navegación del usuario
4. **Personalizable** - Diferentes tipos y estilos
5. **Accionable** - Puede incluir botones de acción
6. **Auto-Dismiss** - Se cierra automáticamente
7. **Animado** - Transiciones suaves

## Notas Técnicas

- El componente se monta en `_layout.tsx` para estar disponible globalmente
- Usa Zustand para el manejo de estado
- Las notificaciones se almacenan en un array para historial
- Solo se muestra una notificación a la vez
- Compatible con iOS y Android
