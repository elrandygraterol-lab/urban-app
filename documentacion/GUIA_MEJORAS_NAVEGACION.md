# Guía de Uso: Mejoras de Navegación para Pasajeros

**Fecha**: 4 de mayo de 2026  
**Versión**: 1.0  
**Aplicación**: App de Taxi - Módulo Pasajero

---

## 📱 Introducción

Esta guía explica las tres nuevas funcionalidades implementadas en la aplicación de pasajeros para mejorar la experiencia de navegación durante los viajes.

---

## 🔄 1. Actualización Dinámica de Ruta

### ¿Qué es?
La ruta mostrada en el mapa se actualiza automáticamente cada 30 segundos para reflejar el camino real que está tomando el conductor.

### ¿Cómo funciona?
- **Automático**: No requiere ninguna acción del pasajero
- **Frecuencia**: Cada 30 segundos durante el viaje
- **Visual**: La línea verde en el mapa se actualiza suavemente

### Beneficios
- ✅ Siempre ves el camino real que está tomando el conductor
- ✅ Si el conductor toma una ruta alternativa (por tráfico, etc.), lo verás inmediatamente
- ✅ Mayor transparencia y confianza

### Ejemplo de Uso
```
Situación: El conductor encuentra tráfico y toma una calle paralela

Antes: La ruta en el mapa seguía mostrando la calle original
Ahora: La ruta se actualiza automáticamente para mostrar la nueva calle
```

### Configuración
Por defecto está **activado**. Si deseas desactivarlo (no recomendado):
- Esta opción estará disponible en una futura actualización en Configuración > Navegación

---

## 📊 2. Indicador de Progreso Visual

### ¿Qué es?
Una barra de progreso en la parte superior del mapa que muestra qué porcentaje del viaje has completado.

### ¿Cómo se ve?
```
┌─────────────────────────────────────┐
│ 🧭 Progreso del viaje               │
│ ████████████░░░░░░░░░░░░░░░░░░░░░░ │
│ 45% completado                      │
└─────────────────────────────────────┘
```

### ¿Cómo funciona?
- **Aparece**: Cuando el viaje comienza (conductor marca "Iniciar viaje")
- **Actualización**: En tiempo real con cada movimiento del conductor
- **Cálculo**: Basado en la distancia recorrida vs. distancia total
- **Desaparece**: Cuando el viaje termina

### Beneficios
- ✅ Sabes exactamente qué porcentaje del viaje has completado
- ✅ Puedes estimar mejor cuánto falta para llegar
- ✅ Reduce la ansiedad al ver progreso claro

### Interpretación
- **0-25%**: Inicio del viaje
- **25-50%**: Primera mitad completada
- **50-75%**: Más de la mitad del camino
- **75-100%**: Casi llegando al destino

### Ejemplo de Uso
```
Situación: Viaje de 10 km

Km 0: Progreso = 0%
Km 2.5: Progreso = 25%
Km 5: Progreso = 50%
Km 7.5: Progreso = 75%
Km 10: Progreso = 100% (llegada)
```

---

## 📍 3. Puntos de Interés en la Ruta

### ¿Qué es?
Marcadores morados en el mapa que muestran lugares conocidos y puntos de referencia cercanos a tu ruta.

### ¿Cómo se ven?
- **Color**: Morado (para diferenciarse de otros marcadores)
- **Forma**: Círculo con ícono de ubicación o negocio
- **Interacción**: Toca el marcador para ver el nombre del lugar

### Lugares Incluidos
Los siguientes landmarks de San Juan de los Morros se muestran cuando están cerca (dentro de 2 km):

1. **Los Morros** 🏔️
   - Landmark principal de la ciudad
   - Tipo: Punto de referencia natural

2. **Plaza Bolívar** 🏛️
   - Centro histórico de la ciudad
   - Tipo: Punto de referencia cultural

3. **Catedral de San Juan** ⛪
   - Iglesia principal
   - Tipo: Punto de referencia religioso

4. **Terminal de Pasajeros** 🚌
   - Estación de autobuses
   - Tipo: Punto de interés

### ¿Cómo funciona?
- **Aparece**: Cuando el viaje comienza
- **Filtrado**: Solo muestra lugares dentro de 2 km de tu ubicación
- **Actualización**: Se cargan una vez al inicio del viaje

### Beneficios
- ✅ Mejor orientación durante el viaje
- ✅ Reconoces lugares conocidos
- ✅ Útil para visitantes que no conocen la ciudad
- ✅ Aumenta la confianza al ver referencias familiares

### Ejemplo de Uso
```
Situación: Viaje desde el centro hacia el norte de la ciudad

Inicio: Ves marcadores de Plaza Bolívar y Catedral (estás cerca)
Mitad del viaje: Ves marcador de Los Morros (pasando cerca)
Final: Los marcadores desaparecen (ya estás lejos)
```

### Tipos de Marcadores
- **🏔️ Landmark**: Punto de referencia importante (ej: Los Morros)
- **🏛️ POI**: Punto de interés general (ej: Terminal)

---

## 🎯 Uso Combinado de las Tres Mejoras

### Escenario Completo: Viaje del Centro al Norte

**Inicio del Viaje (0%)**
```
- Conductor inicia viaje
- Aparece barra de progreso: "0% completado"
- Aparecen marcadores: Plaza Bolívar, Catedral
- Ruta verde muestra el camino completo
```

**Durante el Viaje (45%)**
```
- Barra de progreso: "45% completado"
- Conductor toma calle alternativa por tráfico
- Ruta se actualiza automáticamente (línea verde cambia)
- Pasas cerca de Los Morros (marcador visible)
```

**Cerca del Destino (85%)**
```
- Barra de progreso: "85% completado"
- Ruta actualizada muestra los últimos metros
- Marcadores de landmarks ya no visibles (lejos)
```

**Llegada (100%)**
```
- Barra de progreso: "100% completado"
- Conductor marca "Viaje completado"
- Barra de progreso desaparece
- Aparece pantalla de calificación
```

---

## ⚙️ Configuración y Personalización

### Configuración Actual
Todas las mejoras están **activadas por defecto** para proporcionar la mejor experiencia.

### Futuras Opciones de Configuración
En próximas actualizaciones podrás personalizar:

- **Actualización de Ruta**:
  - Activar/Desactivar
  - Cambiar frecuencia (15s, 30s, 60s)

- **Indicador de Progreso**:
  - Activar/Desactivar
  - Cambiar posición (arriba, abajo)
  - Cambiar estilo (barra, círculo, porcentaje solo)

- **Puntos de Interés**:
  - Activar/Desactivar
  - Cambiar radio de búsqueda (1km, 2km, 5km)
  - Filtrar por tipo (solo landmarks, solo POI, ambos)

---

## 🔧 Solución de Problemas

### La ruta no se actualiza
**Posibles causas**:
- Conexión a internet débil o intermitente
- Servidor de rutas temporalmente no disponible

**Solución**:
- Verifica tu conexión a internet
- La ruta anterior se mantiene visible
- Se reintentará automáticamente en 30 segundos

### El indicador de progreso no aparece
**Posibles causas**:
- El viaje aún no ha iniciado (conductor no marcó "Iniciar viaje")
- Error al calcular distancia inicial

**Solución**:
- Espera a que el conductor inicie el viaje
- Si el problema persiste, reinicia la app

### No veo marcadores de landmarks
**Posibles causas**:
- No hay landmarks dentro de 2 km de tu ubicación
- Estás fuera de San Juan de los Morros

**Solución**:
- Los marcadores solo aparecen cuando estás cerca (< 2 km)
- Actualmente solo disponible para San Juan de los Morros
- Más ciudades se agregarán en futuras actualizaciones

---

## 📊 Impacto en Rendimiento

### Consumo de Batería
- **Impacto**: Mínimo
- **Razón**: Usa las actualizaciones de ubicación existentes
- **Estimado**: < 1% adicional de batería por viaje

### Consumo de Datos
- **Actualización de ruta**: ~5 KB cada 30 segundos
- **Landmarks**: ~2 KB una vez al inicio
- **Total por viaje de 30 min**: ~15 KB
- **Impacto**: Insignificante

### Rendimiento de la App
- **Fluidez**: Sin impacto
- **Animaciones**: Suaves y optimizadas
- **Memoria**: Uso eficiente

---

## 🆘 Soporte

### ¿Tienes preguntas o problemas?

**Contacto**:
- Email: soporte@taxiapp.com
- Teléfono: +58 XXX-XXXXXXX
- Chat en app: Menú > Ayuda > Chat

**Reportar un problema**:
1. Abre la app
2. Ve a Menú > Ayuda > Reportar problema
3. Describe el problema con las mejoras de navegación
4. Adjunta capturas de pantalla si es posible

---

## 📝 Notas de Versión

### Versión 1.0 (Mayo 2026)
- ✅ Implementación inicial de las tres mejoras
- ✅ Soporte para San Juan de los Morros
- ✅ Optimización de rendimiento

### Próximas Actualizaciones
- 🔜 Opciones de configuración personalizables
- 🔜 Más ciudades con landmarks
- 🔜 Notificaciones al pasar cerca de landmarks importantes
- 🔜 Historial de rutas tomadas

---

**Fin de la Guía**

*Última actualización: 4 de mayo de 2026*
