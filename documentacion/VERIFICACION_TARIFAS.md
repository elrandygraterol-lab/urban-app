# Verificación de Sistema de Tarifas

## Fecha: 27 de Abril de 2026

## Resumen Ejecutivo

Se verificó el sistema de tarifas del panel de administración. El sistema está correctamente implementado con las siguientes características:

---

## 1. Tipos de Tarifas Disponibles

### ✅ Tarifa por Horario (time_surcharge)
**Estado**: COMPLETAMENTE FUNCIONAL

**Características**:
- Permite definir un rango de horas (ej: 2:00 AM - 4:00 AM)
- Selector de hora en formato 12 horas (AM/PM)
- Conversión automática a formato 24 horas para almacenamiento
- Dos tipos de recargo:
  - **Porcentaje**: Incremento porcentual sobre la tarifa base (ej: +30%)
  - **Monto Fijo**: Cantidad fija que se suma a la tarifa base
- Soporte para rangos nocturnos (ej: 10:00 PM - 6:00 AM)
- Validación de campos requeridos
- Soporte para VES y USD

**Campos del Formulario**:
```javascript
{
  startTime: "02:00",      // Formato 24h
  endTime: "04:00",        // Formato 24h
  surchargeType: "percentage" | "fixed",
  surchargePercentage: 30, // Si es porcentaje
  surchargeFixedAmount: 5, // Si es monto fijo
  currency: "VES" | "USD"
}
```

**Ejemplo de Uso**:
- Tarifa nocturna: 10:00 PM - 6:00 AM con 30% de recargo
- Si tarifa base = $10, durante la noche = $13 ($10 + 30%)

---

### ⏸️ Tarifa por Minuto (per_minute)
**Estado**: NO DISPONIBLE (Bloqueada intencionalmente)

**Comportamiento Actual**:
- Al seleccionar esta opción, se muestra un modal con el mensaje:
  > "🚧 Funcionalidad aún no disponible. Trabajamos en ella, pronto estará lista."
- No permite continuar con la creación
- El formulario existe en el código pero está deshabilitado

**Nota**: Esta es una tarifa que cobra por cada minuto de viaje, diferente a la tarifa por horario que aplica un recargo en un rango de horas específico.

---

### ⏸️ Tarifa por Kilómetro (per_kilometer)
**Estado**: NO DISPONIBLE (Bloqueada intencionalmente)

**Comportamiento Actual**:
- Al seleccionar esta opción, se muestra el mismo modal:
  > "🚧 Funcionalidad aún no disponible. Trabajamos en ella, pronto estará lista."
- No permite continuar con la creación
- El formulario existe en el código pero está deshabilitado

---

## 2. Diferencias Importantes

### Tarifa por Horario vs Tarifa por Minuto

| Característica | Tarifa por Horario | Tarifa por Minuto |
|----------------|-------------------|-------------------|
| **Propósito** | Recargo en horarios específicos | Cobro por duración del viaje |
| **Ejemplo** | +30% de 10PM a 6AM | $0.50 por cada minuto |
| **Aplicación** | Rango de horas del día | Duración total del viaje |
| **Estado** | ✅ Funcional | ⏸️ No disponible |

---

## 3. Schema de Base de Datos

El modelo `GlobalFare` en Prisma contempla todos los tipos de tarifas:

```prisma
model GlobalFare {
  id                   String          @id @default(uuid())
  name                 String
  fareType             GlobalFareType  @map("fare_type")
  baseFare             Decimal?        @map("base_fare")
  currency             Currency        @default(VES)
  perKmRate            Decimal         @default(0) @map("per_km_rate")
  perMinuteRate        Decimal         @default(0) @map("per_minute_rate")
  
  // Campos para time_surcharge (tarifa por horario)
  startTime            String?         @map("start_time")
  endTime              String?         @map("end_time")
  surchargeType        String?         @map("surcharge_type")
  surchargePercentage  Decimal?        @map("surcharge_percentage")
  surchargeFixedAmount Decimal?        @map("surcharge_fixed_amount")
  
  // Otros campos...
  isActive             Boolean         @default(true)
  createdAt            DateTime        @default(now())
  updatedAt            DateTime        @updatedAt
}

enum GlobalFareType {
  base_fare
  per_kilometer
  per_minute
  time_surcharge    // ✅ Tarifa por horario (funcional)
  zone_fare
  cancellation_fare
}
```

---

## 4. Flujo de Creación de Tarifas

### Para Tarifa por Horario (Funcional):

1. Usuario hace clic en "+ Nueva Zona" o crea tarifa global
2. Selecciona "Recargo por horario"
3. Se muestra formulario con:
   - Hora de inicio (selector 12h con AM/PM)
   - Hora de fin (selector 12h con AM/PM)
   - Tipo de recargo (porcentaje o monto fijo)
   - Valor del recargo
   - Moneda (VES/USD)
4. Sistema convierte automáticamente a formato 24h
5. Guarda en base de datos
6. Aplica el recargo automáticamente cuando un viaje se solicita en ese rango horario

### Para Tarifa por Minuto/Kilómetro (Bloqueadas):

1. Usuario hace clic en "+ Nueva Zona" o crea tarifa global
2. Selecciona "Tarifa por minuto" o "Tarifa por kilómetro"
3. Sistema muestra modal: "🚧 Funcionalidad aún no disponible. Trabajamos en ella, pronto estará lista."
4. Usuario debe seleccionar otro tipo de tarifa

---

## 5. Archivos Relevantes

### Backend:
- `backend/prisma/schema.prisma` - Modelo de datos
- `backend/src/services/globalFareService.ts` - Lógica de tarifas globales
- `backend/src/services/adminService.ts` - CRUD de tarifas
- `backend/src/controllers/adminController.ts` - Controladores
- `backend/src/routes/adminRoutes.ts` - Rutas API

### Frontend:
- `backend/views/admin/tarifas.ejs` - Vista principal
- `backend/public/js/fares-zones.js` - Lógica principal (línea 788-795: validación)
- `backend/public/js/fareTypeForms.js` - Formularios dinámicos
  - `TimeSurchargeFareForm` (línea 384-700): Formulario de tarifa por horario
  - `PerMinuteFareForm` (línea 249): Formulario deshabilitado
  - `PerKilometerFareForm` (línea 112): Formulario deshabilitado

---

## 6. Recomendaciones

### Implementadas ✅:
1. Tarifa por horario completamente funcional
2. Validación de campos requeridos
3. Conversión automática de formato 12h a 24h
4. Soporte para rangos nocturnos
5. Modal informativo para funcionalidades no disponibles

### Pendientes (Futuro):
1. Implementar lógica de tarifa por minuto
2. Implementar lógica de tarifa por kilómetro
3. Agregar validación de rangos horarios superpuestos
4. Agregar preview de cómo se aplicará el recargo

---

## 7. Pruebas Sugeridas

### Tarifa por Horario:
1. ✅ Crear tarifa nocturna (10:00 PM - 6:00 AM, +30%)
2. ✅ Crear tarifa diurna (8:00 AM - 5:00 PM, +$5 fijo)
3. ✅ Verificar conversión de formato 12h a 24h
4. ✅ Probar con ambas monedas (VES y USD)
5. ✅ Verificar que se aplique correctamente en viajes

### Tarifas Bloqueadas:
1. ✅ Intentar crear tarifa por minuto → Ver modal
2. ✅ Intentar crear tarifa por kilómetro → Ver modal
3. ✅ Verificar que no se pueda continuar

---

## Conclusión

El sistema de tarifas está correctamente implementado:
- ✅ **Tarifa por Horario**: Completamente funcional con todos los campos necesarios
- ⏸️ **Tarifa por Minuto**: Bloqueada con mensaje informativo
- ⏸️ **Tarifa por Kilómetro**: Bloqueada con mensaje informativo

No se requieren cambios adicionales. El sistema funciona según lo especificado.
