# Guía de Pruebas - Notificaciones de Viaje

## Estado Actual del Sistema

Según los logs, el sistema está funcionando correctamente:

✅ Socket conectado para conductor
✅ Listeners globales registrados correctamente
✅ Listener `ride:request_created` registrado para driver
✅ Navegación corregida de `/(driver)/index` a `/(driver)`

## Pruebas a Realizar

### Prueba 1: Conductor en Pantalla de Inicio

**Objetivo**: Verificar que el conductor recibe tanto el Alert como la tarjeta visual

**Pasos**:
1. Abrir app como conductor
2. Estar en la pantalla de inicio (mapa)
3. Desde otra app/dispositivo, solicitar un viaje como pasajero
4. **Resultado Esperado**:
   - ✅ Suena notificación
   - ✅ Aparece Alert nativo con detalles del viaje
   - ✅ Aparece tarjeta visual en la pantalla con botones Aceptar/Rechazar

**Acciones Disponibles**:
- Cerrar el Alert → La tarjeta visual permanece
- Presionar "Ver Detalles" en Alert → Cierra Alert, tarjeta permanece
- Presionar "Rechazar" en Alert → Cierra Alert, tarjeta permanece
- Usar botones de la tarjeta → Aceptar o Rechazar el viaje

### Prueba 2: Conductor en Otra Pantalla (Perfil)

**Objetivo**: Verificar que el Alert global funciona en cualquier pantalla

**Pasos**:
1. Abrir app como conductor
2. Navegar a Perfil (o Ganancias, Historial, etc.)
3. Desde otra app/dispositivo, solicitar un viaje como pasajero
4. **Resultado Esperado**:
   - ✅ Suena notificación
   - ✅ Aparece Alert nativo con detalles del viaje
   - ❌ NO aparece tarjeta visual (porque no está en pantalla de inicio)

**Acciones Disponibles**:
- Presionar "Ver Detalles" → Navega a pantalla de inicio, muestra tarjeta
- Presionar "Rechazar" → Cierra Alert, permanece en pantalla actual

### Prueba 3: Navegación desde Alert

**Objetivo**: Verificar que el botón "Ver Detalles" funciona correctamente

**Pasos**:
1. Conductor en pantalla de Ganancias
2. Recibe notificación de nuevo viaje
3. Presionar "Ver Detalles" en el Alert
4. **Resultado Esperado**:
   - ✅ Navega a pantalla de inicio del conductor
   - ✅ Muestra la tarjeta visual con detalles del viaje
   - ✅ Puede aceptar o rechazar desde la tarjeta

### Prueba 4: Múltiples Solicitudes

**Objetivo**: Verificar prevención de duplicados

**Pasos**:
1. Conductor recibe solicitud de viaje A
2. Sin cerrar el Alert, recibe solicitud de viaje B
3. **Resultado Esperado**:
   - ✅ Alert del viaje A se muestra
   - ✅ Alert del viaje B se muestra (después de cerrar A o como nuevo Alert)
   - ❌ NO se muestran múltiples Alerts del mismo viaje

### Prueba 5: Expiración de Solicitud

**Objetivo**: Verificar que las referencias se limpian correctamente

**Pasos**:
1. Conductor recibe solicitud de viaje
2. No interactuar con el Alert
3. Esperar 30 segundos
4. **Resultado Esperado**:
   - ✅ La referencia interna se limpia automáticamente
   - ✅ Si llega una nueva solicitud del mismo viaje, se muestra correctamente

## Logs Importantes a Observar

### Cuando Llega una Solicitud

```
[GLOBAL_SOCKET] 🚗 RIDE REQUEST RECEIVED (GLOBAL)!
[GLOBAL_SOCKET]    Ride ID: xxx
[GLOBAL_SOCKET]    Passenger: xxx
[GLOBAL_SOCKET]    User Role: driver
```

### Cuando se Registran Listeners

```
[GLOBAL_SOCKET] ✅ LISTENERS REGISTERED SUCCESSFULLY
[GLOBAL_SOCKET]    - ride:payment_completed
[GLOBAL_SOCKET]    - ride:cancelled
[GLOBAL_SOCKET]    - ride:request_created (driver only)
```

### Cuando se Previene Duplicado

```
[GLOBAL_SOCKET] ⚠️ Alert already showing for this ride, skipping duplicate
```

## Solución de Problemas

### Problema: No Aparece el Alert

**Posibles Causas**:
1. Usuario no es conductor (`user.role !== 'driver'`)
2. Socket no está conectado
3. Listeners no están registrados

**Verificar en Logs**:
```
[GLOBAL_SOCKET]    User Role: driver  ← Debe ser "driver"
[SOCKET] ✅ CONNECTED SUCCESSFULLY!
[GLOBAL_SOCKET] ✅ Registered ride:request_created listener for driver
```

### Problema: Error "Unmatched Route"

**Solución**: Ya corregido. La navegación ahora usa `router.push('/(driver)')` en lugar de `router.push('/(driver)/index')`

### Problema: Aparecen Múltiples Alerts del Mismo Viaje

**Causa**: El sistema de prevención de duplicados debería evitar esto

**Verificar**: Buscar en logs si aparece el mensaje de prevención de duplicados

### Problema: El Alert No Se Cierra

**Causa**: Los Alerts nativos son bloqueantes y requieren interacción del usuario

**Solución**: El usuario debe presionar uno de los botones (Rechazar o Ver Detalles)

## Comportamiento Esperado por Pantalla

| Pantalla del Conductor | Alert Global | Tarjeta Visual | Sonido |
|------------------------|--------------|----------------|--------|
| Inicio (Mapa) | ✅ Sí | ✅ Sí | ✅ Sí |
| Perfil | ✅ Sí | ❌ No | ✅ Sí |
| Ganancias | ✅ Sí | ❌ No | ✅ Sí |
| Historial | ✅ Sí | ❌ No | ✅ Sí |
| Documentos | ✅ Sí | ❌ No | ✅ Sí |
| Verificación | ✅ Sí | ❌ No | ✅ Sí |

## Notas Técnicas

1. **Doble Notificación en Inicio**: Es intencional. El conductor tiene dos formas de interactuar:
   - Alert global (puede cerrar y usar la tarjeta)
   - Tarjeta visual (para aceptar/rechazar directamente)

2. **Prevención de Duplicados**: Usa `activeRideRequestRef` para rastrear el ID del viaje activo

3. **Auto-expiración**: Después de 30 segundos, la referencia se limpia automáticamente

4. **Navegación**: El botón "Ver Detalles" siempre lleva a `/(driver)` que es la pantalla de inicio

## Comandos Útiles para Debugging

### Ver Logs Filtrados (Socket)
```bash
# En la terminal donde corre la app
# Buscar logs de GLOBAL_SOCKET
```

### Ver Logs del Backend
```bash
cd backend
npm run dev
# Buscar logs de ride:request_created
```

### Limpiar y Reiniciar
```bash
# En la app
npm run start:dev -- --clear

# O simplemente
r  # En la terminal de Expo para reload
```

## Checklist de Verificación

Antes de reportar un problema, verificar:

- [ ] El usuario está autenticado como conductor
- [ ] El socket está conectado (ver logs)
- [ ] Los listeners globales están registrados
- [ ] El evento `ride:request_created` se está emitiendo desde el backend
- [ ] El rol del usuario es "driver" (no "passenger")
- [ ] La app tiene permisos de notificación
- [ ] El sonido está habilitado en el dispositivo

## Resultado de los Logs Actuales

Según los logs compartidos:

✅ Socket conectado correctamente
✅ Listeners globales registrados
✅ Listener `ride:request_created` registrado para driver
✅ Usuario autenticado como driver
✅ Token de notificaciones registrado

**Estado**: Sistema funcionando correctamente. Listo para pruebas.
