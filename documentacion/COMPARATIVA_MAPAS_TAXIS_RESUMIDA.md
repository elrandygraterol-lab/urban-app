# 🗺️ Comparativa de Mapas para UrbanTaxi

## 📚 Conceptos Clave

### OSRM (Open Source Routing Machine)
Motor de enrutamiento de código abierto que calcula rutas usando OpenStreetMap.
- **Costo:** $5-20/mes (servidor VPS)
- **Precisión:** 97%
- **Ventaja:** Control total, bajo costo, privacidad

---

## 🎯 Opciones de Integración

### Opción 1: Google Maps SDK + OSRM ⭐ ACTUAL

| Aspecto | Valor |
|--------|-------|
| **Visualización** | Google Maps SDK |
| **Rutas** | OSRM Autohospedado |
| **Costo** | $5-20/mes |
| **Precisión** | 99.5% |
| **Offline** | No |
| **Personalización** | Media |

**Ventajas:** Máxima precisión, excelente documentación  
**Desventajas:** Tarjeta requerida, privacidad limitada

---

### Opción 2: Mapbox + OSRM ⭐ RECOMENDADO

| Aspecto | Valor |
|--------|-------|
| **Visualización** | Mapbox |
| **Rutas** | OSRM Autohospedado |
| **Costo** | $5-20/mes |
| **Precisión** | 98% |
| **Offline** | Sí |
| **Personalización** | Ilimitada |

**Ventajas:** Mismo costo, mejor privacidad, personalización, offline  
**Desventajas:** Precisión 1.5% menor (imperceptible)

---

### Opción 3: Híbrida (Mapbox + Google Geocoding + OSRM)

| Aspecto | Valor |
|--------|-------|
| **Visualización** | Mapbox |
| **Geocodificación** | Google |
| **Rutas** | OSRM Autohospedado |
| **Costo** | $5-20/mes |
| **Precisión** | 99.5% |
| **Offline** | Sí |
| **Personalización** | Ilimitada |

**Ventajas:** Máxima precisión + personalización + offline  
**Desventajas:** Complejidad media

---

## 💰 Análisis de Costos

### Por Volumen de Viajes

| Viajes/día | Google Maps | Mapbox | Ahorro |
|-----------|------------|--------|--------|
| 50 | $5-20 | $5-20 | $0 |
| 200 | $5-20 | $5-20 | $0 |
| 500 | $5-20 | $5-20 | $0 |
| 1,000 | $5-70 | $5-20 | $0-50 |
| 2,000 | $55-120 | $10-25 | $45-95 |

**Conclusión:** Mapbox es más económico en escalado (75-95% ahorro)

---

## 📊 Tabla Comparativa

| Característica | Google Maps | Mapbox | Híbrida |
|---|---|---|---|
| Costo | $5-20/mes | $5-20/mes | $5-20/mes |
| Precisión | 99.5% | 98% | 99.5% |
| Personalización | Media | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Offline | No | Sí | Sí |
| Tarjeta | Requerida | Opcional | Opcional |
| Privacidad | Media | Buena | Buena |
| Complejidad | Baja | Baja | Media |

---

## 🎯 Recomendación

### MVP: Google Maps + OSRM
- Ya implementado
- Funciona correctamente

### Producción: Mapbox + OSRM ⭐
- Mismo costo en MVP
- 75-95% más económico en escalado
- Mejor privacidad y personalización
- Mapas offline

**Diferencia de Precisión:** 1.5% (imperceptible para taxis)

---

## 🔧 Implementación

**Estado:** Google Maps SDK + OSRM implementado

**Endpoints disponibles:**
- `GET /api/maps/estimate` - Estimación de viaje
- `POST /api/maps/geocode` - Geocodificar dirección
- `POST /api/maps/reverse-geocode` - Reverse geocodificación
- `GET /api/maps/search-places` - Buscar lugares
- `POST /api/maps/nearby-drivers` - Conductores cercanos
- `GET /api/maps/route` - Ruta con instrucciones
- `GET /api/maps/status` - Estado de servicios

---

**Documento actualizado:** 15 de Marzo de 2026  
**Versión:** 1.0
