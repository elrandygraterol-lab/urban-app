# 🗺️ Estrategia de Mapas para UrbanTaxi

## 📚 Conceptos Clave

### OSRM (Open Source Routing Machine)
Motor de enrutamiento de código abierto que calcula rutas usando OpenStreetMap.
- **Costo:** $5-20/mes (servidor VPS)
- **Precisión:** 97%
- **Ventaja:** Control total, bajo costo, privacidad

### Mapbox
Plataforma de mapas moderna con personalización ilimitada.
- **Costo:** $0-5/mes
- **Precisión:** 98%
- **Ventaja:** Personalización, offline, mejor privacidad

---

## 🎯 Estrategia Implementada: Mapbox + OSRM ⭐

| Aspecto | Valor |
|--------|-------|
| **Visualización** | Mapbox |
| **Rutas** | OSRM Autohospedado |
| **Costo** | $5-20/mes |
| **Precisión** | 98% |
| **Offline** | Sí |
| **Personalización** | Ilimitada |

### Ventajas
- ✅ Bajo costo ($5-20/mes)
- ✅ Personalización ilimitada para marca UrbanTaxi
- ✅ Mapas offline para conductores en zonas rurales
- ✅ Mejor privacidad (datos bajo control)
- ✅ Escalabilidad sin límites de costo
- ✅ Sin tarjeta de crédito requerida
- ✅ Datos abiertos (OpenStreetMap)

### Desventajas
- ❌ Precisión 1.5% menor que Google (98% vs 99.5%)
- ❌ Comunidad más pequeña
- ❌ Documentación ligeramente menor

**Nota:** La diferencia de precisión es imperceptible para aplicaciones de taxis.

---

## 💰 Análisis de Costos

### Por Volumen de Viajes

| Viajes/día | Costo Mensual |
|-----------|---------------|
| 50 | $5-20 |
| 200 | $5-20 |
| 500 | $5-20 |
| 1,000 | $5-20 |
| 2,000 | $10-25 |

**Conclusión:** Costo fijo sin importar volumen (escalabilidad ilimitada)

---

## 🔧 Implementación

**Estado:** Mapbox + OSRM implementado

**Servicios:**
- `mapboxService.ts` - Geocodificación y búsqueda
- `osrmService.ts` - Cálculo de rutas
- `mapsService.ts` - Servicio integrado

**Endpoints disponibles:**
- `GET /api/maps/estimate` - Estimación de viaje
- `POST /api/maps/geocode` - Geocodificar dirección
- `POST /api/maps/reverse-geocode` - Reverse geocodificación
- `GET /api/maps/search-places` - Buscar lugares
- `POST /api/maps/nearby-drivers` - Conductores cercanos
- `GET /api/maps/route` - Ruta con instrucciones
- `GET /api/maps/status` - Estado de servicios

---

## 🚀 Configuración

### Backend

**Variables de Entorno (.env):**
```bash
# Mapbox API
MAPBOX_API_KEY=your_mapbox_token

# OSRM Configuration
OSRM_URL=https://router.project-osrm.org
# O para autohospedado:
# OSRM_URL=http://localhost:5000
```

### Obtener Mapbox Token

1. Ir a [Mapbox](https://www.mapbox.com/)
2. Crear cuenta
3. Obtener token de acceso
4. Copiar token en `.env`

---

## 📊 Comparativa con Alternativas

| Característica | Mapbox + OSRM | Google Maps + OSRM |
|---|---|---|
| Costo | $5-20/mes | $5-70/mes |
| Precisión | 98% | 99.5% |
| Personalización | Ilimitada | Media |
| Offline | Sí | No |
| Tarjeta | Opcional | Requerida |
| Privacidad | Buena | Media |

**Ahorro:** 75-95% en escalado

---

## ✅ Conclusión

**Mapbox + OSRM es la mejor opción para UrbanTaxi porque:**

1. **Costo:** $5-20/mes (fijo, sin importar volumen)
2. **Precisión:** 98% (suficiente para taxis)
3. **Personalización:** Ilimitada (marca UrbanTaxi)
4. **Offline:** Soportado (conductores en zonas rurales)
5. **Privacidad:** Mejor control de datos
6. **Escalabilidad:** Ilimitada sin aumentar costo

---

**Documento actualizado:** 15 de Marzo de 2026  
**Versión:** 2.0
