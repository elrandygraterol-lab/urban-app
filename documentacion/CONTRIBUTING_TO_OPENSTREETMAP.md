# Guía para Contribuir a OpenStreetMap

Esta guía te ayudará a mejorar los datos de mapas de OpenStreetMap para tu zona, lo que mejorará la precisión de las rutas en la aplicación UrbanTaxi.

## ¿Por qué contribuir?

OpenStreetMap es un proyecto colaborativo que crea un mapa libre y editable del mundo. Al contribuir:

- ✅ Mejoras la precisión de las rutas en tu app de taxis
- ✅ Ayudas a toda la comunidad que usa OpenStreetMap
- ✅ Es completamente gratis y de código abierto
- ✅ Tus cambios se reflejan en miles de aplicaciones que usan OSM

## Diferencias entre OSRM/OSM y Google Maps

| Aspecto | OSRM + OpenStreetMap | Google Maps |
|---------|---------------------|-------------|
| **Costo** | Gratis, ilimitado | $5 por 1000 solicitudes después de $200/mes gratis |
| **Datos** | Comunidad (puede estar desactualizado) | Propietario de Google (muy actualizado) |
| **Tráfico en tiempo real** | No | Sí |
| **Precisión** | 85-95% (depende de la zona) | 95-99% |
| **Actualización** | Manual (comunidad) | Automática (Google) |
| **Control** | Total (puedes editar) | Ninguno |

## Paso 1: Crear una cuenta

1. Ve a https://www.openstreetmap.org
2. Haz clic en **"Sign Up"** (Registrarse)
3. Completa el formulario:
   - Email
   - Nombre de usuario
   - Contraseña
4. Confirma tu email
5. ¡Listo! Ya puedes editar

## Paso 2: Familiarízate con el editor

### Editor iD (Recomendado para principiantes)

1. Inicia sesión en OpenStreetMap
2. Navega al área que quieres editar (Valencia, Guacara, etc.)
3. Haz clic en **"Edit"** en la parte superior
4. Se abrirá el editor iD (interfaz web intuitiva)
5. Completa el tutorial interactivo (15 minutos)

**URL directa al editor en tu zona:**
```
https://www.openstreetmap.org/edit?editor=id#map=15/10.2590/-67.8962
```

### Controles básicos del editor

- **Clic izquierdo**: Seleccionar elemento
- **Doble clic**: Agregar punto a una línea
- **Arrastrar**: Mover elementos
- **Suprimir/Delete**: Eliminar elemento seleccionado
- **Ctrl + Z**: Deshacer
- **Ctrl + S**: Guardar cambios

## Paso 3: Qué puedes editar

### 🛣️ Calles y carreteras

**Agregar calles nuevas:**
1. Selecciona la herramienta "Línea"
2. Haz clic para crear puntos a lo largo de la calle
3. Doble clic para terminar
4. Selecciona el tipo: "Carretera", "Calle residencial", etc.
5. Agrega el nombre de la calle

**Información útil para agregar:**
- ✅ Nombre de la calle
- ✅ Tipo de vía (autopista, avenida, calle, camino)
- ✅ Límite de velocidad
- ✅ Número de carriles
- ✅ Sentido único (oneway=yes)
- ✅ Superficie (pavimentada, tierra, adoquines)
- ✅ Restricciones de giro

**Ejemplo de etiquetas:**
```
name = Avenida Bolívar
highway = primary
lanes = 4
maxspeed = 60
surface = asphalt
oneway = yes
```

### 🏢 Lugares importantes

**Para taxis, estos son especialmente útiles:**
- 🚉 Terminales de transporte
- 🏥 Hospitales y clínicas
- ⛽ Gasolineras
- 🏪 Centros comerciales
- 🍽️ Restaurantes populares
- 🏨 Hoteles
- ✈️ Aeropuertos
- 🏛️ Edificios gubernamentales

**Cómo agregar un lugar:**
1. Selecciona la herramienta "Punto"
2. Haz clic en la ubicación
3. Busca el tipo de lugar (ej: "Terminal de autobuses")
4. Agrega nombre y detalles

### 🚦 Detalles de navegación

**Rotondas:**
- Marca las rotondas correctamente
- Esto mejora las instrucciones de navegación

**Restricciones de giro:**
- "No girar a la izquierda"
- "Solo giro a la derecha"
- Estas son críticas para rutas precisas

**Puentes y túneles:**
- Marca si una vía es un puente (bridge=yes)
- Marca si es un túnel (tunnel=yes)

## Paso 4: Herramientas adicionales

### JOSM (Editor avanzado de escritorio)

Para ediciones más complejas o masivas:

1. Descarga: https://josm.openstreetmap.de/
2. Instala Java si no lo tienes
3. Abre JOSM y descarga el área que quieres editar
4. Edita offline
5. Sube los cambios cuando termines

**Ventajas de JOSM:**
- Más potente y rápido
- Plugins para validación automática
- Edición offline
- Mejor para cambios grandes

### StreetComplete (App móvil Android)

La forma más fácil de contribuir mientras caminas o conduces:

1. Descarga: https://play.google.com/store/apps/details?id=de.westnordost.streetcomplete
2. Abre la app en tu zona
3. Responde preguntas simples sobre lugares que ves:
   - "¿Esta calle tiene nombre?"
   - "¿Cuántos carriles tiene?"
   - "¿Hay acera?"
4. Tus respuestas se suben automáticamente

**Perfecto para:**
- Conductores de taxi (mientras esperas pasajeros)
- Agregar datos mientras haces tu ruta diaria

### Mapillary (Fotos de calles)

Sube fotos de calles para ayudar a otros mapeadores:

1. Descarga la app: https://www.mapillary.com/
2. Graba video mientras conduces
3. La app sube las fotos automáticamente
4. Otros pueden usar tus fotos para mapear

## Paso 5: Buenas prácticas

### ✅ Haz esto:

- **Edita solo lo que conoces**: Mapea lugares que has visitado personalmente
- **Usa imágenes satelitales**: Disponibles en el editor como referencia
- **Agrega fuentes**: En el comentario de cambios, menciona de dónde obtuviste la info
- **Empieza pequeño**: Haz cambios menores al principio
- **Verifica antes de guardar**: Revisa que todo esté correcto
- **Describe tus cambios**: Al guardar, escribe qué editaste (ej: "Agregué calles en Los Guayos")

### ❌ No hagas esto:

- **NO copies de Google Maps**: Es ilegal (violación de copyright)
- **NO inventes información**: Solo agrega datos verificables
- **NO hagas cambios masivos sin experiencia**: Practica primero
- **NO borres sin estar seguro**: Si algo está mal, corrígelo en lugar de borrarlo
- **NO uses datos privados**: No agregues información personal o sensible

## Paso 6: Guardar y publicar cambios

1. Haz clic en **"Save"** (Guardar) en el editor
2. Revisa el resumen de cambios
3. Agrega un comentario descriptivo:
   ```
   Agregué calles faltantes en urbanización Los Guayos, Valencia
   ```
4. Selecciona la fuente de datos:
   - "Local knowledge" (Conocimiento local)
   - "Survey" (Levantamiento en campo)
   - "Bing aerial imagery" (Imágenes satelitales de Bing)
5. Haz clic en **"Upload"** (Subir)

**Los cambios se reflejan:**
- En OpenStreetMap: Inmediatamente
- En aplicaciones que usan OSM: 1-7 días (depende de cada app)

## Paso 7: Actualizar OSRM con nuevos datos

Después de editar OpenStreetMap, para que tu app use los nuevos datos:

### Opción 1: Usar servidor público de OSRM (Automático)

El servidor público se actualiza semanalmente. Solo espera unos días.

### Opción 2: Actualizar tu servidor OSRM local (Manual)

```bash
# 1. Descargar datos actualizados de Venezuela
cd ~/osrm-data
wget http://download.geofabrik.de/south-america/venezuela-latest.osm.pbf -O venezuela-latest.osm.pbf

# 2. Procesar los datos
osrm-extract -p /usr/local/share/osrm/profiles/car.lua venezuela-latest.osm.pbf
osrm-partition venezuela-latest.osrm
osrm-customize venezuela-latest.osrm

# 3. Reiniciar el servidor OSRM
pkill osrm-routed
osrm-routed --algorithm=MLD venezuela-latest.osrm --port 5000 &
```

**Frecuencia recomendada:** Mensual o cuando hagas cambios importantes

## Paso 8: Unirse a la comunidad

### Comunidad venezolana de OpenStreetMap

- **Telegram**: https://t.me/osmve
- **Wiki**: https://wiki.openstreetmap.org/wiki/Venezuela
- **Forum**: https://community.openstreetmap.org/c/communities/ve/
- **Mailing list**: https://lists.openstreetmap.org/listinfo/talk-ve

### Recursos de aprendizaje

- **LearnOSM**: https://learnosm.org/es/ (Tutoriales en español)
- **OSM Wiki**: https://wiki.openstreetmap.org/wiki/ES:Main_Page
- **YouTube**: Busca "OpenStreetMap tutorial español"
- **Maptime**: https://maptime.io/ (Eventos de mapeo)

## Paso 9: Áreas prioritarias para UrbanTaxi

Para mejorar la precisión de rutas en tu app, enfócate en:

### 🎯 Alta prioridad:

1. **Calles principales y avenidas**
   - Autopistas
   - Avenidas principales
   - Vías de acceso rápido

2. **Zonas comerciales**
   - Centros comerciales
   - Mercados
   - Zonas de restaurantes

3. **Puntos de interés para taxis**
   - Terminales de transporte
   - Aeropuertos
   - Hospitales
   - Hoteles

4. **Restricciones de tráfico**
   - Calles de un solo sentido
   - Restricciones de giro
   - Zonas peatonales

### 📍 Zonas geográficas sugeridas:

- Valencia (centro y zonas comerciales)
- Guacara
- San Diego
- Naguanagua
- Los Guayos
- Autopista Valencia-Puerto Cabello

## Paso 10: Medir el impacto

Después de contribuir, puedes ver tu impacto:

1. **Tu perfil de usuario**: https://www.openstreetmap.org/user/TU_USUARIO
2. **Estadísticas**: https://hdyc.neis-one.org/?TU_USUARIO
3. **Mapa de calor**: https://yosmhm.neis-one.org/?TU_USUARIO

## Consejos para conductores de taxi

Como conductor de taxi, tienes conocimiento único de las calles:

- 📍 Conoces atajos que no están en el mapa
- 🚧 Sabes qué calles están en mal estado
- 🚦 Conoces las restricciones de tráfico reales
- 🏪 Sabes dónde están los lugares importantes

**Rutina sugerida:**
- 5 minutos al día editando mientras esperas pasajeros
- Usa StreetComplete en tu teléfono
- Enfócate en tu zona de trabajo habitual

## Preguntas frecuentes

### ¿Cuánto tiempo toma aprender?
- Tutorial básico: 15 minutos
- Ediciones simples: Desde el primer día
- Ediciones avanzadas: 1-2 semanas de práctica

### ¿Puedo equivocarme?
Sí, y está bien. La comunidad revisa los cambios y puede corregir errores. Empieza con cambios pequeños.

### ¿Necesito conocimientos técnicos?
No. Si puedes usar Google Maps, puedes editar OpenStreetMap.

### ¿Cuánto debo contribuir?
Lo que quieras. Incluso 5 minutos al mes ayuda. No hay mínimo ni máximo.

### ¿Puedo ganar dinero contribuyendo?
No directamente, pero mejoras tu propia app de taxis, lo que puede aumentar tus ingresos con rutas más precisas.

## Recursos adicionales

### Documentación oficial:
- https://wiki.openstreetmap.org/wiki/ES:Beginners%27_guide
- https://wiki.openstreetmap.org/wiki/ES:Map_Features

### Validadores de datos:
- **OSM Inspector**: https://tools.geofabrik.de/osmi/
- **KeepRight**: https://www.keepright.at/
- **Osmose**: https://osmose.openstreetmap.fr/

### Herramientas de análisis:
- **Overpass Turbo**: https://overpass-turbo.eu/ (Consultas avanzadas)
- **TagInfo**: https://taginfo.openstreetmap.org/ (Estadísticas de etiquetas)

## Conclusión

Contribuir a OpenStreetMap es:
- ✅ Gratis
- ✅ Fácil de aprender
- ✅ Beneficia a tu app y a toda la comunidad
- ✅ Mejora la precisión de las rutas
- ✅ Te da control total sobre los datos

**¡Empieza hoy!** Incluso 5 minutos de edición pueden marcar la diferencia.

---

**Última actualización**: Marzo 2026  
**Mantenido por**: Equipo UrbanTaxi  
**Licencia**: Este documento es de dominio público
