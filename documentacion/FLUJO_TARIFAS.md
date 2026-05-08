# Flujo del Sistema de Tarifas — UrbanTaxi

## 1. Creación de Tarifas (Panel Admin)

```mermaid
flowchart TD
    A([Admin abre Zonas y Tarifas]) --> B{¿Qué tipo de tarifa?}

    B --> C[Tarifa por Zona]
    B --> D[Tarifa Global]
    B --> E[Matriz de Tarifas]

    %% ── TARIFA POR ZONA ──────────────────────────────────────
    C --> C1[Dibuja polígono en el mapa]
    C1 --> C2[Completa formulario:\nNombre · Color · Prioridad]
    C2 --> C3[Define Tarifa Base + Moneda\nTipo: ZONA = precio fijo]
    C3 --> C4[(zone_fares\nfareType = ZONA)]

    %% ── TARIFA GLOBAL ────────────────────────────────────────
    D --> D1{Subtipo}
    D1 --> D2[Tarifa Base Global\nfareType = BASE]
    D1 --> D3[Por Kilómetro\nfareType = KILOMETRO]
    D1 --> D4[Por Minuto/Hora\nfareType = HORA]
    D1 --> D5[Recargo por Horario\nfareType = time_surcharge]

    D2 --> D6[(global_fares)]
    D3 --> D6
    D4 --> D6
    D5 --> D6

    %% ── MATRIZ ───────────────────────────────────────────────
    E --> E1[Selecciona Zona Origen]
    E1 --> E2[Selecciona Zona Destino]
    E2 --> E3{Tipo de tarifa\npara esa ruta}
    E3 --> E4[ZONA: precio fijo]
    E3 --> E5[KILOMETRO: base + $/km]
    E3 --> E6[HORA: base + $/hora]
    E4 --> E7[(zone_fare_matrix\noriginZoneId · destinationZoneId)]
    E5 --> E7
    E6 --> E7

    style C fill:#d1fae5,stroke:#059669
    style D fill:#dbeafe,stroke:#2563eb
    style E fill:#ede9fe,stroke:#7c3aed
    style C4 fill:#f0fdf4,stroke:#16a34a
    style D6 fill:#eff6ff,stroke:#3b82f6
    style E7 fill:#f5f3ff,stroke:#8b5cf6
```

---

## 2. Flujo de Solicitud de Carrera y Aplicación de Tarifa

```mermaid
flowchart TD
    P([Pasajero solicita carrera\nvía App]) --> P1[Envía coordenadas:\nPickup lat/lng\nDestino lat/lng]

    P1 --> Z1[PostGIS detecta\nZona ORIGEN]
    P1 --> Z2[PostGIS detecta\nZona DESTINO]

    Z1 --> M{¿Ambas zonas\ndetectadas?}
    Z2 --> M

    %% ── PASO 1: MATRIZ ───────────────────────────────────────
    M -->|Sí| M1{¿Existe entrada\nen la Matriz\nOrigen → Destino?}
    M1 -->|Sí| M2[Usar tarifa de la Matriz\nzona_fare_matrix]
    M2 --> CALC

    %% ── PASO 2: TARIFA ZONA ORIGEN ───────────────────────────
    M1 -->|No| F1{¿Zona ORIGEN\ntiene tarifa\nconfigrada?}
    M -->|Solo origen| F1

    F1 -->|Sí| F1A{fareType de\nla zona origen}
    F1A -->|ZONA| F1B[Precio fijo\n= baseFare]
    F1A -->|KILOMETRO| F1C[baseFare + perKmRate × km]
    F1A -->|HORA| F1D[baseFare + perHourRate × horas]
    F1B --> CALC
    F1C --> CALC
    F1D --> CALC

    %% ── PASO 3: TARIFA ZONA DESTINO ──────────────────────────
    F1 -->|No| F2{¿Zona DESTINO\ntiene tarifa\nconfigurada?}
    M -->|Solo destino| F2

    F2 -->|Sí| F2A{fareType de\nla zona destino}
    F2A -->|ZONA| F2B[Precio fijo\n= baseFare]
    F2A -->|KILOMETRO| F2C[baseFare + perKmRate × km]
    F2A -->|HORA| F2D[baseFare + perHourRate × horas]
    F2B --> CALC
    F2C --> CALC
    F2D --> CALC

    %% ── PASO 4: TARIFA GLOBAL ────────────────────────────────
    F2 -->|No| F3{¿fare_policies\ntiene tarifa\npor defecto?}
    M -->|Ninguna zona| F3

    F3 -->|Sí| F3A[Usar tarifa global\nfare_policies.defaultFareType]
    F3A --> CALC
    F3 -->|No| ERR([Error 422\nServicio no disponible\nen esta área])

    %% ── CÁLCULO FINAL ────────────────────────────────────────
    CALC[Calcular precio bruto] --> POL[Aplicar políticas\nfare_policies]
    POL --> POL1{¿Precio < mínimo?}
    POL1 -->|Sí| POL2[Aplicar tarifa mínima]
    POL1 -->|No| POL3[Precio sin cambio]
    POL2 --> RND[Aplicar redondeo\nsegún roundingMode]
    POL3 --> RND
    RND --> RES([Precio final\ndevuelto al pasajero])

    style M2 fill:#d1fae5,stroke:#059669,color:#065f46
    style F1B fill:#d1fae5,stroke:#059669,color:#065f46
    style F1C fill:#dbeafe,stroke:#2563eb,color:#1e40af
    style F1D fill:#ede9fe,stroke:#7c3aed,color:#5b21b6
    style F2B fill:#d1fae5,stroke:#059669,color:#065f46
    style F2C fill:#dbeafe,stroke:#2563eb,color:#1e40af
    style F2D fill:#ede9fe,stroke:#7c3aed,color:#5b21b6
    style F3A fill:#fef3c7,stroke:#d97706,color:#92400e
    style ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b
    style RES fill:#d1fae5,stroke:#10b981,color:#065f46
```

---

## 3. Prioridad de Tarifas (resumen)

| Prioridad | Fuente | Condición |
|-----------|--------|-----------|
| **1 — Más específica** | Matriz `zone_fare_matrix` | Existe entrada para Origen → Destino |
| **2** | Tarifa zona ORIGEN `zone_fares` | Origen detectado, sin entrada en matriz |
| **3** | Tarifa zona DESTINO `zone_fares` | Destino detectado, origen fuera de cobertura |
| **4 — Más general** | Política global `fare_policies` | Ninguna zona detectada |
| **Error** | — | Sin política por defecto configurada |

---

## 4. Tipos de Tarifa y su Fórmula

| fareType | Fórmula | Cuándo usarla |
|----------|---------|---------------|
| `ZONA` | `precio = baseFare` (fijo) | Precio único dentro de la zona, sin importar distancia ni tiempo |
| `KILOMETRO` | `precio = baseFare + perKmRate × km` | Viajes donde la distancia es el factor principal |
| `HORA` | `precio = baseFare + perHourRate × horas` | Servicios de espera o trayectos lentos |
| `BASE` | `precio = baseFare` (global) | Tarifa mínima global cuando no hay zona configurada |

---

## 5. Cuándo se usa cada tipo de tarifa (casos reales)

```
Pasajero en Centro → Aeropuerto
  └─ Existe en Matriz: Centro→Aeropuerto = 1500 Bs  ✓ usa Matriz

Pasajero en Zona Norte → Zona Sur
  └─ No existe en Matriz
  └─ Zona Norte tiene tarifa ZONA = 800 Bs           ✓ usa Zona Origen

Pasajero en carretera (fuera de zona) → Zona Centro
  └─ No existe en Matriz (origen sin zona)
  └─ Zona Centro tiene tarifa KILOMETRO              ✓ usa Zona Destino

Pasajero en área rural → área rural
  └─ Ninguna zona detectada
  └─ fare_policies.defaultFareType = BASE = 500 Bs   ✓ usa Política Global
```
