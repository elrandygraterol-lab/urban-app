# Notificaciones Globales para Pasajeros

## Descripción

Este documento describe todas las notificaciones in-app que el pasajero recibirá durante el flujo de un viaje. Todas estas notificaciones aparecen en cualquier pantalla de la aplicación, no solo en la pantalla de inicio.

## Notificaciones Implementadas

### 1. Conductor Aceptó el Viaje

**Tipo:** `ride_accepted` (Verde con checkmark)
**Cuándo:** Cuando un conductor acepta la solicitud de viaje
**Mensaje:**

```
Título: ¡Conductor Asignado!
Mensaje: [Nombre del conductor] ha aceptado tu viaje.

[Modelo del vehículo] - [Placa]
Rating: [X.X] ⭐
```

### 2. Conductor Llegó al Punto de Recogida

**Tipo:** `driver_arrived` (Naranja con icono de ubicación)
**Cuándo:** Cuando el conductor llega al punto de recogida
**Mensaje:**

```
Título: Conductor ha Llegado
Mensaje: Tu conductor ha llegado al punto de recogida.
```

### 3. Viaje Iniciado

**Tipo:** `ride_started` (Azul con play)
**Cuándo:** Cuando el conductor inicia el viaje
**Mensaje:**

```
Título: Viaje Iniciado
Mensaje: ¡Tu viaje ha comenzado! Disfruta el trayecto.
```

### 4. Viaje Cancelado por el Sistema

**Tipo:** `warning` (Naranja con advertencia)
**Cuándo:** Cuando no se encuentran conductores disponibles
**Mensaje:**

```
Título: No hay conductores disponibles
Mensaje: No se encontraron conductores disponibles en este momento. Por favor, intenta nuevamente.
```

### 5. Viaje Cancelado por el Conductor

**Tipo:** `ride_cancelled` (Rojo con X)
**Cuándo:** Cuando el conductor cancela el viaje
**Mensaje:**

```
Título: Viaje Cancelado por el Conductor
Mensaje: El conductor ha cancelado el viaje.

Razón: [Razón de cancelación]

Estamos buscando otro conductor para ti.
```

### 6. Viaje Cancelado por el Pasajero

**Tipo:** `info` (Azul con información)
**Cuándo:** Cuando el pasajero cancela su propio viaje
**Mensaje:**

```
Título: Viaje Cancelado
Mensaje: Tu viaje ha sido cancelado.

[Si aplica] Tarifa de cancelación: Bs. X.XX
```

### 7. Pago Confirmado (Pago Móvil)

**Tipo:** `success` (Verde con checkmark)
**Cuándo:** Cuando el pasajero completa el pago móvil
**Mensaje:**

```
Título: Pago Confirmado
Mensaje: Tu pago ha sido procesado. El conductor está en camino.
```

### 8. Pago Pendiente

**Tipo:** `warning` (Naranja con advertencia)
**Cuándo:** Cuando el pasajero cancela el pago móvil
**Mensaje:**

```
Título: Pago Pendiente
Mensaje: Debes completar el pago para que el conductor inicie el viaje.
```

### 9. Valoración Enviada

**Tipo:** `success` (Verde con checkmark)
**Cuándo:** Cuando el pasajero envía su valoración del conductor
**Mensaje:**

```
Título: ¡Gracias!
Mensaje: Tu valoración ha sido enviada exitosamente.
```

### 10. No Hay Conductores Disponibles (Error al Solicitar)

**Tipo:** `warning` (Naranja con advertencia)
**Cuándo:** Error 404 al solicitar un viaje
**Mensaje:**

```
Título: No hay conductores disponibles
Mensaje: Lo sentimos, no hay conductores disponibles en tu área en este momento. Por favor, intenta nuevamente en unos minutos.
```

### 11. Error al Solicitar Viaje

**Tipo:** `error` (Rojo con alerta)
**Cuándo:** Error general al solicitar un viaje
**Mensaje:**

```
Título: No se pudo solicitar el viaje
Mensaje: [Mensaje de error del backend]

O

Título: Error al solicitar viaje
Mensaje: Ocurrió un problema al solicitar tu viaje. Por favor, verifica tu conexión e intenta nuevamente.
```

## Características de las Notificaciones

### Diseño Visual

- **Icono circular colorido** según el tipo de notificación
- **Animación de entrada** desde la parte superior
- **Auto-dismiss** después de 5 segundos
- **Botón de cerrar manual** para cerrar antes
- **Sombras y bordes** para destacar

### Comportamiento

- Aparecen en **todas las pantallas** de la app (inicio, perfil, historial, etc.)
- **No bloquean** la interacción del usuario
- Se pueden **cerrar manualmente** o esperar el auto-dismiss
- Algunas incluyen **botones de acción** para navegar a pantallas específicas

### Tipos de Notificaciones por Color

| Tipo             | Color   | Uso                  |
| ---------------- | ------- | -------------------- |
| `success`        | Verde   | Operaciones exitosas |
| `info`           | Azul    | Información general  |
| `warning`        | Naranja | Advertencias         |
| `error`          | Rojo    | Errores              |
| `ride_accepted`  | Verde   | Conductor aceptó     |
| `ride_cancelled` | Rojo    | Viaje cancelado      |
| `driver_arrived` | Naranja | Conductor llegó      |
| `ride_started`   | Azul    | Viaje iniciado       |

## Notas Importantes

1. **Alerts vs Notificaciones Globales:**
   - Los errores de validación de formularios siguen usando `Alert.alert` (bloqueantes)
   - Los eventos importantes del viaje usan notificaciones globales (no bloqueantes)

2. **Sesión Expirada:**
   - Sigue usando `Alert.alert` porque requiere que el usuario inicie sesión nuevamente

3. **Errores de Ubicación:**
   - Siguen usando `Alert.alert` porque son críticos para el funcionamiento

4. **Confirmaciones de Cancelación:**
   - El modal de confirmación de cancelación sigue siendo un modal dedicado
   - Solo la notificación de resultado usa el sistema global

## Ventajas para el Pasajero

✅ Recibe notificaciones en cualquier pantalla donde esté
✅ No interrumpe su navegación por la app
✅ Diseño moderno y profesional
✅ Información clara y concisa
✅ Auto-dismiss para no molestar
✅ Puede cerrar manualmente si lo desea
