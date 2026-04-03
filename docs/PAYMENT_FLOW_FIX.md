# Fix: Error de Pago - Estado del Viaje

## Problema Identificado

El sistema mostraba dos alertas contradictorias al procesar un pago:
1. "Pago Confirmado" ✅
2. "Error al Procesar Pago" ❌ (Error 409: No se puede procesar pago para viaje en estado: accepted)

### Causa Raíz

Había dos problemas principales:

1. **Backend**: El controlador `completePayment` solo permitía procesar pagos cuando el viaje estaba en estado `completed`, pero el flujo actual requiere que el pasajero pague cuando el viaje está en estado `accepted` (justo después de que el conductor acepta).

2. **Frontend**: Se mostraba un Alert de "Procesando Pago" de forma síncrona, y luego se intentaba mostrar otro Alert inmediatamente. React Native no permite múltiples Alerts simultáneos, causando comportamiento inconsistente.

## Solución Implementada

### 1. Backend (`backend/src/controllers/rideController.ts`)

**Antes:**
```typescript
// Check ride is completed
if (ride.status !== 'completed') {
  throw new AppError(
    409,
    `No se puede procesar pago para viaje en estado: ${ride.status}`
  );
}
```

**Después:**
```typescript
// Check ride is in valid state for payment
// Allow payment in 'accepted', 'arrived', 'in_progress', or 'completed' states
const validPaymentStates = ['accepted', 'arrived', 'in_progress', 'completed'];
if (!validPaymentStates.includes(ride.status)) {
  throw new AppError(
    409,
    `No se puede procesar pago para viaje en estado: ${ride.status}`
  );
}
```

**Cambio**: Ahora el backend acepta pagos en múltiples estados válidos:
- `accepted` - Cuando el conductor acaba de aceptar el viaje
- `arrived` - Cuando el conductor ha llegado al punto de recogida
- `in_progress` - Cuando el viaje está en curso
- `completed` - Cuando el viaje ha terminado

### 2. Frontend (`app/app/(passenger)/index.tsx`)

**Antes:**
```typescript
try {
  setShowMobilePaymentModal(false);
  
  // Mostrar indicador de procesamiento con Alert
  Alert.alert(
    'Procesando Pago',
    'Estamos verificando tu pago...',
    [{ text: 'OK' }]
  );

  // Llamar al backend
  const response = await paymentAPI.completePayment(...);

  // Mostrar confirmación (PROBLEMA: Alert anterior aún visible)
  Alert.alert('Pago Confirmado', ...);
}
```

**Después:**
```typescript
try {
  // Cerrar modal y mostrar loading
  setShowMobilePaymentModal(false);
  setIsRequestingRide(true); // Usar estado de loading existente

  // Llamar al backend
  const response = await paymentAPI.completePayment(...);

  // Ocultar loading
  setIsRequestingRide(false);

  // Mostrar confirmación (ahora sin conflictos)
  Alert.alert('Pago Confirmado', ...);
}
```

**Cambios**:
1. Eliminado el Alert de "Procesando Pago" que causaba conflictos
2. Usar el estado `isRequestingRide` para mostrar un indicador de carga visual
3. Mejorado el manejo de errores para extraer mensajes más específicos del backend

## Flujo Correcto Ahora

1. **Pasajero solicita viaje** → Estado: `pending`
2. **Conductor acepta viaje** → Estado: `accepted`
3. **Pasajero ve modal de pago móvil** → Puede pagar inmediatamente
4. **Pasajero confirma pago** → 
   - Frontend muestra loading
   - Backend valida que el estado sea válido (`accepted` ✅)
   - Backend procesa el pago
   - Backend emite evento `ride:payment_completed` al conductor
5. **Conductor recibe notificación nativa** → Alert con detalles de ganancias
6. **Pasajero ve confirmación** → Alert de "Pago Confirmado"

## Estados Válidos para Pago

| Estado | Descripción | Permite Pago |
|--------|-------------|--------------|
| `pending` | Esperando conductor | ❌ |
| `accepted` | Conductor aceptó | ✅ |
| `arrived` | Conductor llegó | ✅ |
| `in_progress` | Viaje en curso | ✅ |
| `completed` | Viaje terminado | ✅ |
| `cancelled` | Viaje cancelado | ❌ |

## Beneficios

1. ✅ El pasajero puede pagar inmediatamente después de que el conductor acepta
2. ✅ No más alertas contradictorias
3. ✅ Mejor experiencia de usuario con indicador de carga
4. ✅ Mensajes de error más claros y específicos
5. ✅ El conductor recibe la notificación de pago correctamente

## Archivos Modificados

1. `backend/src/controllers/rideController.ts` - Lógica de validación de estado
2. `app/app/(passenger)/index.tsx` - Manejo de UI y alertas

## Pruebas Recomendadas

1. ✅ Solicitar viaje como pasajero
2. ✅ Aceptar viaje como conductor
3. ✅ Completar pago móvil como pasajero
4. ✅ Verificar que el conductor recibe la notificación
5. ✅ Verificar que solo se muestra un Alert de confirmación
6. ✅ Probar el flujo de error (sin conexión, etc.)
