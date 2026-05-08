# Verificación: Aplicación de Tarifa por Horario (time_surcharge)

## Fecha: 27 de Abril de 2026

## ✅ Verificación Completa

He revisado el código del sistema de cálculo de tarifas y **confirmo que la tarifa por horario (time_surcharge) se aplica correctamente SUMÁNDOSE a la tarifa base**.

---

## Flujo de Cálculo de Tarifas

### Archivo: `backend/src/services/zoneFareMatrixService.ts`

El método `estimateFare()` sigue este flujo:

### 1. **Cálculo de Tarifa Base** (Líneas 157-304)

El sistema usa un sistema de cascada para determinar la tarifa base:

```
Nivel 1: zone_fare_matrix (matriz origen-destino)
   ↓ (si no existe)
Nivel 2: zone_fares por zona de origen
   ↓ (si no existe)
Nivel 3: zone_fares por zona de destino
   ↓ (si no existe)
Nivel 4: global base_fare (tarifa base global activa)
   ↓ (si no existe)
Nivel 5: fare_policies default (política por defecto)
```

**Resultado**: `rawPrice` = Tarifa base calculada

---

### 2. **Aplicación de Recargo por Horario** (Líneas 305-323)

```typescript
// ── Apply time_surcharge if active and within window ─────────────────────
let surchargeInfo: FareEstimateResponse['timeSurcharge'] = undefined;
let priceAfterSurcharge = rawPrice;

const timeSurcharge = await getActiveTimeSurcharge();
if (timeSurcharge && isWithinSurchargeWindow(timeSurcharge)) {
  const surchargeAmount = calculateSurchargeAmount(rawPrice, timeSurcharge);
  priceAfterSurcharge = Math.round((rawPrice + surchargeAmount) * 100) / 100;
  surchargeInfo = {
    applied: true,
    amount:  surchargeAmount,
    type:    timeSurcharge.surchargeType,
    value:   timeSurcharge.surchargeType === 'percentage'
               ? timeSurcharge.surchargePercentage
               : timeSurcharge.surchargeFixedAmount,
  };
}
```

**Lógica**:
1. Obtiene la tarifa por horario activa (si existe)
2. Verifica si la hora actual está dentro del rango configurado
3. **SUMA** el recargo a la tarifa base: `priceAfterSurcharge = rawPrice + surchargeAmount`

---

### 3. **Aplicación de Políticas Finales** (Líneas 325-330)

```typescript
// ── Apply policies (minimum fare + rounding) ─────────────────────────────
const { finalPrice, minimumApplied, roundingApplied } = farePoliciesService.applyPolicies(
  priceAfterSurcharge,
  fareConfig.currency,
  policies,
);
```

Aplica:
- Tarifa mínima (si el precio es menor al mínimo configurado)
- Redondeo (según la política configurada)

---

## Cálculo del Recargo

### Archivo: `backend/src/services/globalFareService.ts`

### Función: `calculateSurchargeAmount()`

```typescript
export function calculateSurchargeAmount(
  basePrice: number,
  surcharge: ActiveTimeSurcharge,
): number {
  if (surcharge.surchargeType === 'percentage') {
    return Math.round(basePrice * (surcharge.surchargePercentage / 100) * 100) / 100;
  }
  return surcharge.surchargeFixedAmount;
}
```

**Dos tipos de recargo**:

1. **Porcentaje**: `recargo = tarifa_base × (porcentaje / 100)`
   - Ejemplo: Tarifa base $10, recargo 30% → $10 × 0.30 = $3
   - Total: $10 + $3 = **$13**

2. **Monto Fijo**: `recargo = monto_fijo`
   - Ejemplo: Tarifa base $10, recargo $5 → $5
   - Total: $10 + $5 = **$15**

---

## Detección de Rango Horario

### Función: `isWithinSurchargeWindow()`

```typescript
export function isWithinSurchargeWindow(
  surcharge: ActiveTimeSurcharge,
  nowUtc: Date = new Date(),
): boolean {
  // Convert to Venezuela time (UTC-4, no DST)
  const VEN_OFFSET_MS = -4 * 60 * 60 * 1000;
  const venTime = new Date(nowUtc.getTime() + VEN_OFFSET_MS);
  const currentMinutes = venTime.getUTCHours() * 60 + venTime.getUTCMinutes();

  const [startH, startM] = surcharge.startTime.split(':').map(Number);
  const [endH, endM]     = surcharge.endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes   = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Normal range: e.g. 08:00 → 20:00
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight range: e.g. 22:00 → 06:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}
```

**Características**:
- ✅ Convierte automáticamente a hora de Venezuela (UTC-4)
- ✅ Soporta rangos normales (ej: 8:00 AM - 5:00 PM)
- ✅ Soporta rangos nocturnos (ej: 10:00 PM - 6:00 AM)
- ✅ Usa comparación de minutos desde medianoche para precisión

---

## Ejemplos de Uso

### Ejemplo 1: Recargo Porcentual Nocturno

**Configuración**:
- Tarifa base: $10.00 VES
- Recargo nocturno: 30% de 10:00 PM a 6:00 AM

**Escenario 1: Viaje a las 2:00 AM** (dentro del rango)
```
1. Tarifa base calculada: $10.00
2. Hora actual: 2:00 AM → Dentro del rango (10:00 PM - 6:00 AM)
3. Recargo: $10.00 × 30% = $3.00
4. Precio con recargo: $10.00 + $3.00 = $13.00
5. Aplicar políticas (mínimo/redondeo)
6. Precio final: $13.00
```

**Escenario 2: Viaje a las 12:00 PM** (fuera del rango)
```
1. Tarifa base calculada: $10.00
2. Hora actual: 12:00 PM → Fuera del rango
3. Recargo: NO SE APLICA
4. Precio con recargo: $10.00
5. Aplicar políticas (mínimo/redondeo)
6. Precio final: $10.00
```

---

### Ejemplo 2: Recargo Fijo Diurno

**Configuración**:
- Tarifa base: $15.00 VES
- Recargo hora pico: $5.00 fijo de 7:00 AM a 9:00 AM

**Escenario: Viaje a las 8:00 AM** (dentro del rango)
```
1. Tarifa base calculada: $15.00
2. Hora actual: 8:00 AM → Dentro del rango (7:00 AM - 9:00 AM)
3. Recargo: $5.00 (fijo)
4. Precio con recargo: $15.00 + $5.00 = $20.00
5. Aplicar políticas (mínimo/redondeo)
6. Precio final: $20.00
```

---

## Respuesta de la API

La respuesta de `estimateFare()` incluye información detallada del recargo:

```typescript
{
  totalPrice: 13.00,
  currency: "VES",
  originZone: { id: "...", name: "Centro" },
  destinationZone: { id: "...", name: "Norte" },
  fareType: "ZONA",
  priceBreakdown: {
    base: 10.00,
    distance: 0,
    time: 0,
    subtotal: 13.00,        // Incluye el recargo
    minimumApplied: false,
    roundingApplied: false,
    finalTotal: 13.00
  },
  fareConfigId: "...",
  usedFallback: false,
  timeSurcharge: {          // ✅ Información del recargo aplicado
    applied: true,
    amount: 3.00,
    type: "percentage",
    value: 30
  }
}
```

---

## Conclusión

✅ **VERIFICADO**: La tarifa por horario (time_surcharge) se aplica correctamente:

1. ✅ Se calcula DESPUÉS de determinar la tarifa base
2. ✅ Se SUMA a la tarifa base (no la reemplaza)
3. ✅ Soporta dos tipos: porcentaje y monto fijo
4. ✅ Detecta correctamente rangos normales y nocturnos
5. ✅ Convierte automáticamente a hora de Venezuela (UTC-4)
6. ✅ Incluye información detallada en la respuesta de la API

**El sistema funciona exactamente como se especificó**: El recargo por horario se suma a la tarifa que se haya aplicado en ese momento.

---

## Archivos Clave

- `backend/src/services/zoneFareMatrixService.ts` - Lógica principal de cálculo
- `backend/src/services/globalFareService.ts` - Funciones de recargo por horario
- `backend/prisma/schema.prisma` - Modelo de datos (GlobalFare)
- `backend/public/js/fareTypeForms.js` - Formulario frontend (TimeSurchargeFareForm)
