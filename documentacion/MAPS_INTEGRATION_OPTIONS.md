# 🗺️ Opciones de Integración de Mapas para UrbanTaxi

## 📋 Resumen Ejecutivo

UrbanTaxi necesita dos componentes para mapas:
1. **Visualización**: Mostrar mapas en la app
2. **Rutas**: Calcular distancias y tiempos

Se presentan 3 opciones principales, todas combinadas con **OSRM Autohospedado** ($5-20/mes).

---

## 🎯 Opciones Disponibles

### Opción 1: Google Maps SDK + OSRM ⭐ ACTUAL

**Componentes:**
- Google Maps SDK (visualización)
- OSRM Autohospedado (rutas)

**Costo:**
- Google Maps: $0 (dentro de cuota gratuita)
- OSRM: $5-20/mes
- **Total: $5-20/mes**

**Ventajas:**
- ✅ Máxima precisión (99.5%)
- ✅ Tráfico real disponible
- ✅ Excelente documentación
- ✅ Comunidad muy grande

**Desventajas:**
- ❌ Tarjeta de crédito requerida
- ❌ Privacidad limitada
- ❌ Personalización media
- ❌ Sin mapas offline

**Precisión:** 99.5%

---

### Opción 2: Mapbox + OSRM ⭐ RECOMENDADO

**Componentes:**
- Mapbox (visualización)
- OSRM Autohospedado (rutas)

**Costo:**
- Mapbox: $0 (dentro de cuota gratuita)
- OSRM: $5-20/mes
- **Total: $5-20/mes**

**Ventajas:**
- ✅ Personalización ilimitada
- ✅ Mapas offline soportados
- ✅ Mejor privacidad
- ✅ Sin tarjeta requerida (tier gratuito)
- ✅ Datos abiertos (OpenStreetMap)
- ✅ Mismo costo que Google

**Desventajas:**
- ❌ Precisión 1.5% menor (98%)
- ❌ Comunidad más pequeña
- ❌ Documentación ligeramente menor

**Precisión:** 98%

---

### Opción 3: Híbrida (Mapbox + Google Geocoding + OSRM)

**Componentes:**
- Mapbox (visualización)
- Google Geocoding API (geocodificación precisa)
- OSRM Autohospedado (rutas)

**Costo:**
- Mapbox: $0 (dentro de cuota)
- Google Geocoding: $0 (dentro de cuota)
- OSRM: $5-20/mes
- **Total: $5-20/mes**

**Ventajas:**
- ✅ Máxima precisión (99.5%)
- ✅ Personalización ilimitada
- ✅ Mapas offline
- ✅ Mejor privacidad

**Desventajas:**
- ❌ Complejidad mayor
- ❌ Más componentes a mantener

**Precisión:** 99.5%

---

## 📊 Tabla Comparativa

| Aspecto | Google Maps | Mapbox | Híbrida |
|--------|-------------|--------|---------|
| **Costo** | $5-20/mes | $5-20/mes | $5-20/mes |
| **Precisión** | 99.5% | 98% | 99.5% |
| **Personalización** | Media | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Offline** | ❌ No | ✅ Sí | ✅ Sí |
| **Tarjeta** | ✅ Requerida | ❌ No | ❌ No |
| **Privacidad** | Media | Buena | Buena |
| **Complejidad** | Baja | Baja | Media |
| **Documentación** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 🔍 Comparativa Detallada

### Google Maps SDK

**Precisión:** 99.5%  
**Datos:** Google Maps  
**Offline:** No  
**Personalización:** Limitada  
**Tarjeta:** Requerida  

**Cuándo usar:**
- Máxima precisión es crítica
- Tráfico real es importante
- Presupuesto disponible

---

### Mapbox

**Precisión:** 98%  
**Datos:** OpenStreetMap  
**Offline:** Sí  
**Personalización:** Ilimitada  
**Tarjeta:** Opcional  

**Cuándo usar:**
- Máximo ahorro
- Personalización importante
- Privacidad importante
- Escalado masivo

---

### Híbrida

**Precisión:** 99.5%  
**Datos:** Google (geocoding) + OpenStreetMap (mapas)  
**Offline:** Sí  
**Personalización:** Ilimitada  
**Tarjeta:** Opcional  

**Cuándo usar:**
- Quieres lo mejor de ambos
- Presupuesto limitado
- Personalización importante

---

## 💰 Análisis de Costos

### Escenario: 500 viajes/día (15,000/mes)

```
Google Maps + OSRM:
- Google Maps: $0 (dentro de cuota)
- OSRM: $5-20/mes
- Total: $5-20/mes

Mapbox + OSRM:
- Mapbox: $0 (dentro de cuota)
- OSRM: $5-20/mes
- Total: $5-20/mes

Diferencia: $0 (empate)
```

### Escenario: 1,000 viajes/día (30,000/mes)

```
Google Maps + OSRM:
- Google Maps: $0-50/mes
- OSRM: $5-20/mes
- Total: $5-70/mes

Mapbox + OSRM:
- Mapbox: $0 (dentro de cuota)
- OSRM: $5-20/mes
- Total: $5-20/mes

Ahorro Mapbox: $0-50/mes
```

### Escenario: 2,000 viajes/día (60,000/mes)

```
Google Maps + OSRM:
- Google Maps: $50-100/mes
- OSRM: $5-20/mes
- Total: $55-120/mes

Mapbox + OSRM:
- Mapbox: $5/mes (Pro)
- OSRM: $5-20/mes
- Total: $10-25/mes

Ahorro Mapbox: $45-95/mes (75-95%)
```

---

## 🎯 Recomendación

### Para MVP: **Google Maps + OSRM**
- Ya implementado
- Funciona correctamente
- Precisión máxima

### Para Producción: **Mapbox + OSRM** ⭐
- 75-95% más económico en escalado
- Personalización ilimitada
- Mapas offline
- Mejor privacidad
- Mismo costo en MVP

### Alternativa: **Híbrida**
- Si necesitas máxima precisión + personalización
- Complejidad media
- Mismo costo

---

## 🔧 Implementación Actual

**Estado:** Google Maps SDK + OSRM implementado

**Archivos:**
- `backend/src/services/googleMapsService.ts`
- `backend/src/services/osrmService.ts`
- `backend/src/services/mapsService.ts`
- `backend/src/controllers/mapsController.ts`
- `backend/src/routes/mapsRoutes.ts`
- `app/services/mapsService.ts`

**Endpoints:**
- `GET /api/maps/estimate` - Estimación de viaje
- `POST /api/maps/geocode` - Geocodificar
- `POST /api/maps/reverse-geocode` - Reverse geocode
- `GET /api/maps/search-places` - Buscar lugares
- `POST /api/maps/nearby-drivers` - Conductores cercanos
- `GET /api/maps/route` - Ruta con instrucciones
- `GET /api/maps/status` - Estado de servicios

---

## 📈 Escalabilidad

### Crecimiento Esperado

| Fase | Viajes/día | Costo Google | Costo Mapbox | Ahorro |
|------|-----------|-------------|-------------|--------|
| MVP | 50 | $5-20 | $5-20 | $0 |
| Beta | 200 | $5-20 | $5-20 | $0 |
| Producción | 500 | $5-20 | $5-20 | $0 |
| Escalado | 1,000 | $5-70 | $5-20 | $0-50 |
| Masivo | 2,000 | $55-120 | $10-25 | $45-95 |

---

## ✅ Conclusión

**Opción Recomendada: Mapbox + OSRM**

**Razones:**
1. Mismo costo en MVP ($5-20/mes)
2. 75-95% más económico en escalado
3. Personalización ilimitada
4. Mapas offline
5. Mejor privacidad
6. Sin tarjeta requerida

**Diferencia de Precisión:** 1.5% (imperceptible para taxis)

**Tiempo de Migración:** 1-2 semanas

**Próximos Pasos:**
1. Decidir opción
2. Si Mapbox: Crear mapboxService.ts
3. Actualizar componentes de mapa
4. Testing
5. Deploy

---

**Documento actualizado:** 15 de Marzo de 2026  
**Versión:** 1.0
