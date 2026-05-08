# Sistema de Tarifas — UrbanTaxi

---

## 1. Creación de Tarifas (Panel Admin)

```
Admin abre "Zonas y Tarifas"
            │
            ▼
   ┌─────────────────┐
   │ ¿Qué tipo?      │
   └────┬──────┬─────┘
        │      │      └──────────────────┐
        ▼      ▼                         ▼
  ┌──────────┐ ┌──────────────┐  ┌──────────────────┐
  │ TARIFA   │ │ TARIFA       │  │ MATRIZ DE        │
  │ POR ZONA │ │ GLOBAL       │  │ TARIFAS          │
  └────┬─────┘ └──────┬───────┘  └────────┬─────────┘
       │               │                   │
       ▼               ▼                   ▼
  Dibuja polígono  Elige subtipo:     Selecciona
  en el mapa       ┌─ Tarifa Base     Zona Origen
       │           ├─ Por Kilómetro        │
       ▼           ├─ Por Hora        Selecciona
  Nombre, color,  └─ Recargo Horario  Zona Destino
  prioridad            │                   │
       │               ▼                   ▼
       ▼          [global_fares]      Elige tipo:
  Tarifa Base +                       ┌─ ZONA (fijo)
  Moneda                              ├─ KILOMETRO
       │                              └─ HORA
       ▼                                   │
  [zone_fares]                             ▼
  fareType = ZONA                  [zone_fare_matrix]
                                   origen → destino
```

---

## 2. Solicitud de Carrera — Flujo Completo

```
Pasajero solicita carrera (App)
            │
            ▼
  Envía coordenadas GPS:
  ┌─────────────────────┐
  │  Pickup  lat / lng  │
  │  Destino lat / lng  │
  └──────────┬──────────┘
             │
             ▼
  PostGIS detecta zonas:
  ┌──────────────────────────────┐
  │  Zona ORIGEN  (pickup)       │
  │  Zona DESTINO (destino)      │
  └──────────────┬───────────────┘
                 │
                 ▼
  ╔══════════════════════════════════════╗
  ║  NIVEL 1 — MATRIZ (más específico)  ║
  ╚══════════════════════════════════════╝
                 │
                 ▼
  ┌─────────────────────────────────────┐
  │ ¿Existe entrada en la Matriz        │
  │ para Zona Origen → Zona Destino?    │
  └──────────┬──────────────────────────┘
             │
      ┌──────┴──────┐
      │ SÍ          │ NO
      ▼             ▼
  Usar tarifa   ╔══════════════════════════════════════╗
  de la Matriz  ║  NIVEL 2 — TARIFA ZONA ORIGEN       ║
  ──────────    ╚══════════════════════════════════════╝
  Ir a CÁLCULO              │
                            ▼
               ┌────────────────────────────┐
               │ ¿Zona Origen tiene tarifa  │
               │ configurada?               │
               └──────────┬─────────────────┘
                          │
                   ┌──────┴──────┐
                   │ SÍ          │ NO
                   ▼             ▼
            ¿fareType?    ╔══════════════════════════════════════╗
            ┌──────────   ║  NIVEL 3 — TARIFA ZONA DESTINO      ║
            │ ZONA        ╚══════════════════════════════════════╝
            │  └─ precio = baseFare (fijo)         │
            │                                      ▼
            │ KILOMETRO             ┌──────────────────────────────┐
            │  └─ baseFare          │ ¿Zona Destino tiene tarifa   │
            │     + perKmRate × km  │ configurada?                 │
            │                       └──────────┬───────────────────┘
            │ HORA                             │
            │  └─ baseFare                ┌────┴────┐
            │     + perHourRate × horas   │ SÍ      │ NO
            │                             ▼         ▼
            └──────────────────    ¿fareType?  ╔══════════════════════════╗
            Ir a CÁLCULO           (igual que  ║  NIVEL 4 — GLOBAL        ║
                                   nivel 2)    ╚══════════════════════════╝
                                        │              │
                                   Ir a CÁLCULO        ▼
                                              ┌────────────────────────┐
                                              │ ¿fare_policies tiene   │
                                              │ tarifa por defecto?    │
                                              └──────────┬─────────────┘
                                                         │
                                                  ┌──────┴──────┐
                                                  │ SÍ          │ NO
                                                  ▼             ▼
                                             Usar tarifa   ERROR 422
                                             global        Servicio no
                                             ──────────    disponible
                                             Ir a CÁLCULO  en esta área
```

---

## 3. Cálculo Final del Precio

```
         CÁLCULO
            │
            ▼
  Calcular precio bruto
  según fórmula del tipo:
  ┌─────────────────────────────────────────┐
  │  ZONA      →  precio = baseFare         │
  │  KILOMETRO →  baseFare + rate × km      │
  │  HORA      →  baseFare + rate × horas   │
  └──────────────────────┬──────────────────┘
                         │
                         ▼
              Aplicar fare_policies
                         │
                         ▼
          ┌──────────────────────────┐
          │ ¿precio < tarifa mínima? │
          └──────────┬───────────────┘
                     │
              ┌──────┴──────┐
              │ SÍ          │ NO
              ▼             ▼
         Usar tarifa   Precio sin
         mínima        cambio
              │             │
              └──────┬───────┘
                     │
                     ▼
          ┌──────────────────────────┐
          │ Aplicar redondeo         │
          │ (NONE / NEAREST_INTEGER  │
          │  / NEAREST_HALF)         │
          └──────────┬───────────────┘
                     │
                     ▼
          ┌──────────────────────────┐
          │   PRECIO FINAL           │
          │   devuelto al pasajero   │
          └──────────────────────────┘
```

---

## 4. Resumen de Prioridades

```
┌─────┬──────────────────────────┬──────────────────────────────────────────┐
│ Nº  │ Fuente                   │ Condición                                │
├─────┼──────────────────────────┼──────────────────────────────────────────┤
│  1  │ Matriz zone_fare_matrix  │ Existe entrada para Origen → Destino     │
│  2  │ Tarifa zona ORIGEN       │ Origen detectado, sin entrada en matriz  │
│  3  │ Tarifa zona DESTINO      │ Destino detectado, origen sin cobertura  │
│  4  │ Política global          │ Ninguna zona detectada                   │
│  ✗  │ Error 422                │ Sin política por defecto configurada     │
└─────┴──────────────────────────┴──────────────────────────────────────────┘
```

---

## 5. Casos Reales

```
CASO 1 — Ruta en la Matriz
  Pasajero: Centro  →  Destino: Aeropuerto
  Matriz tiene: Centro → Aeropuerto = 1500 Bs
  Resultado: 1500 Bs  [Nivel 1]

CASO 2 — Sin entrada en Matriz, zona origen configurada
  Pasajero: Zona Norte  →  Destino: Zona Sur
  Sin entrada en Matriz
  Zona Norte: ZONA = 800 Bs (precio fijo)
  Resultado: 800 Bs  [Nivel 2]

CASO 3 — Pasajero fuera de cobertura, destino en zona conocida
  Pasajero: carretera (sin zona)  →  Destino: Zona Centro
  Sin zona origen, sin entrada en Matriz
  Zona Centro: KILOMETRO, base 200 Bs + 50 Bs/km, distancia 8 km
  Resultado: 200 + (50 × 8) = 600 Bs  [Nivel 3]

CASO 4 — Ninguna zona detectada
  Pasajero: área rural  →  Destino: área rural
  Sin zonas, sin Matriz
  fare_policies: tarifa base = 500 Bs
  Resultado: 500 Bs  [Nivel 4]

CASO 5 — Sin configuración alguna
  Sin zonas, sin Matriz, sin política global
  Resultado: Error 422 — Servicio no disponible en esta área
```
