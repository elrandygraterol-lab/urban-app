# Guía del Sistema de Tarifas — UrbanTaxi

## ¿Qué es este sistema?

UrbanTaxi maneja un sistema de tarifas en capas. El objetivo es que **siempre exista un precio** para cualquier carrera, desde el más específico (una ruta exacta configurada) hasta el más general (una tarifa de respaldo global). El administrador configura las tarifas desde el panel, y el sistema las aplica automáticamente cuando un pasajero solicita una carrera.

---

## Parte 1 — Tipos de tarifas que existen

### Tarifa por Zona

Es una tarifa asociada a un polígono geográfico dibujado en el mapa. Cuando el pasajero está dentro de esa zona, esa tarifa aplica como referencia.

- Se crea dibujando el polígono en el mapa y definiendo un precio base.
- El tipo es siempre **ZONA** (precio fijo), lo que significa que el precio no varía por distancia ni tiempo — es un monto fijo por cualquier viaje que salga desde esa zona.
- Ejemplo: Zona Centro = 700 Bs. Cualquier carrera que salga del Centro cuesta 700 Bs si no hay una tarifa más específica configurada.

### Tarifa Global

Es una tarifa que aplica en toda la plataforma, sin estar ligada a ninguna zona geográfica. Sirve como respaldo cuando el pasajero está fuera de cualquier zona configurada.

Existen cuatro subtipos:

| Subtipo | Descripción |
|---------|-------------|
| **Tarifa Base** | Precio fijo mínimo para cualquier carrera |
| **Por Kilómetro** | Precio base + monto adicional por cada km recorrido |
| **Por Minuto/Hora** | Precio base + monto adicional por tiempo de viaje |
| **Recargo por Horario** | Recargo adicional que se suma en horarios específicos (ej: tarifa nocturna) |

### Matriz de Tarifas

Es la configuración más específica del sistema. Permite definir un precio exacto para una ruta concreta: **Zona A → Zona B**.

- Se configura seleccionando una zona de origen y una zona de destino.
- Cada celda de la matriz puede tener su propio tipo de tarifa (fija, por km, por hora).
- Ejemplo: Centro → Aeropuerto = 1500 Bs fijo. Aeropuerto → Centro = 1200 Bs fijo.
- Si no se configura una celda, el sistema usa las tarifas de fallback descritas más abajo.

---

## Parte 2 — Cómo se calcula el precio de una carrera

Cuando un pasajero solicita una carrera, el sistema recibe las coordenadas GPS del punto de recogida y del destino. A partir de ahí sigue este proceso:

### Paso 1 — Detección de zonas

El sistema usa PostGIS para determinar en qué zona geográfica cae cada punto:

- Detecta la **zona de origen** (donde está el pasajero).
- Detecta la **zona de destino** (a dónde va el pasajero).

Si un punto cae fuera de todos los polígonos dibujados, esa zona queda como `null` (sin zona detectada). Esto no es un error — simplemente activa los niveles de fallback.

### Paso 2 — Búsqueda de tarifa (por prioridad)

El sistema busca la tarifa más específica disponible, en este orden:

---

#### Nivel 1 — Matriz de Tarifas *(más específico)*

Si ambas zonas fueron detectadas, el sistema busca si existe una entrada configurada en la matriz para esa combinación exacta (Zona Origen → Zona Destino).

- Si existe → **usa esa tarifa**. Es el precio más preciso posible.
- Si no existe → pasa al siguiente nivel.

---

#### Nivel 2 — Tarifa de la Zona Origen

Si no hay entrada en la matriz, el sistema busca la tarifa configurada para la zona donde está el pasajero.

- Si la zona origen tiene tarifa → **usa esa tarifa**.
- El tipo de tarifa respeta lo que el admin configuró:
  - **ZONA**: cobra el precio fijo definido para esa zona.
  - **KILOMETRO**: cobra precio base + tarifa por km recorrido.
  - **HORA**: cobra precio base + tarifa por hora de viaje.
- Si no hay tarifa en la zona origen → pasa al siguiente nivel.

---

#### Nivel 3 — Tarifa de la Zona Destino

Si el origen no tiene zona detectada (el pasajero está fuera de cobertura) pero el destino sí, el sistema usa la tarifa de la zona destino.

- Aplica la misma lógica de tipos que el nivel anterior.
- Si tampoco hay tarifa en la zona destino → pasa al siguiente nivel.

---

#### Nivel 4 — Política Global *(más general)*

Si ninguna zona fue detectada o ninguna tiene tarifa configurada, el sistema usa la tarifa por defecto definida en las políticas globales (`fare_policies`).

- Si hay política configurada → **usa esa tarifa**.
- Si no hay política configurada → el sistema devuelve un error 422 indicando que el servicio no está disponible en esa área.

---

### Paso 3 — Aplicación de políticas finales

Una vez determinado el precio bruto, el sistema aplica dos ajustes adicionales:

1. **Tarifa mínima**: si el precio calculado es menor al mínimo configurado, se cobra el mínimo.
2. **Redondeo**: según el modo configurado (`NONE`, `NEAREST_INTEGER`, `NEAREST_HALF`), el precio se redondea.

El resultado es el **precio final** que se muestra al pasajero.

---

## Parte 3 — Fórmulas de cálculo

| Tipo | Fórmula |
|------|---------|
| ZONA | `precio = baseFare` |
| KILOMETRO | `precio = baseFare + (perKmRate × distanciaKm)` |
| HORA | `precio = baseFare + (perHourRate × duracionHoras)` |

---

## Parte 4 — Ejemplos prácticos

**Caso 1: Ruta configurada en la matriz**
> Pasajero en Centro, destino Aeropuerto.
> La matriz tiene Centro → Aeropuerto = 1500 Bs.
> → El sistema cobra **1500 Bs** (Nivel 1).

**Caso 2: Sin entrada en la matriz, zona origen configurada**
> Pasajero en Zona Norte, destino Zona Sur.
> No hay entrada en la matriz para esa ruta.
> Zona Norte tiene tarifa ZONA = 800 Bs.
> → El sistema cobra **800 Bs** (Nivel 2).

**Caso 3: Pasajero fuera de cobertura, destino en zona conocida**
> Pasajero en carretera (fuera de cualquier zona), destino Zona Centro.
> No hay zona origen detectada, no hay entrada en la matriz.
> Zona Centro tiene tarifa KILOMETRO: base 200 Bs + 50 Bs/km.
> Distancia: 8 km → 200 + (50 × 8) = **600 Bs** (Nivel 3).

**Caso 4: Ninguna zona detectada**
> Pasajero y destino en área rural sin zonas configuradas.
> fare_policies tiene tarifa base global = 500 Bs.
> → El sistema cobra **500 Bs** (Nivel 4).

**Caso 5: Sin configuración alguna**
> Ninguna zona, ninguna política configurada.
> → El sistema devuelve **error 422**: servicio no disponible en esta área.

---

## Parte 5 — Recomendaciones para el administrador

- **Configura siempre una tarifa global** en `fare_policies` como red de seguridad. Así ninguna carrera queda sin precio.
- **Usa la matriz** para rutas frecuentes o especiales (aeropuerto, terminal, centros comerciales) donde quieres un precio fijo independiente de la zona.
- **Usa tarifas por zona** para definir el precio base de cada área de la ciudad.
- **La prioridad es siempre**: Matriz > Zona Origen > Zona Destino > Global. Cuanto más específica la configuración, más control tienes sobre el precio.
- Si una zona tiene alta demanda o costos especiales (aeropuerto, zona industrial), dale mayor **prioridad** en la configuración para que sus tarifas no sean solapadas por otras zonas.
