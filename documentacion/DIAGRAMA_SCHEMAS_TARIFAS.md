# 📊 DIAGRAMA VISUAL: SCHEMAS DE TARIFAS Y FLUJO DE CREACIÓN

## 🏗️ ARQUITECTURA DE SCHEMAS DE TARIFAS

```mermaid
erDiagram
    %% TARIFAS GLOBALES
    GlobalFare {
        string id PK
        string name
        GlobalFareType fareType
        decimal baseFare
        Currency currency
        decimal perKmRate
        decimal perMinuteRate
        decimal surgeMultiplier
        decimal cancellationFee
        decimal platformCommission
        boolean isActive
        datetime createdAt
        datetime updatedAt
        string createdById FK
        string updatedById FK
    }

    %% ZONAS GEOGRÁFICAS
    Zone {
        string id PK
        string name
        string description
        geography boundary
        string color
        int priority
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    %% TARIFAS POR ZONA
    ZoneFare {
        string id PK
        string zoneId FK
        FareType fareType
        decimal baseFare
        decimal perKmRate
        decimal perHourRate
        boolean isActive
        datetime createdAt
        datetime updatedAt
        Currency currency
    }

    %% MATRIZ DE TARIFAS ENTRE ZONAS
    ZoneFareMatrix {
        string id PK
        string originZoneId FK
        string destinationZoneId FK
        FareType fareType
        decimal fixedPrice
        decimal baseRate
        decimal unitRate
        Currency currency
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    %% CONFIGURACIÓN GENERAL DE TARIFAS
    FareConfig {
        string id PK
        VehicleType vehicleType
        decimal baseFare
        decimal perKmRate
        decimal perMinuteRate
        decimal platformCommissionPercentage
        decimal cancellationFee
        decimal surgeMultiplier
        boolean isActive
        datetime effectiveFrom
        datetime createdAt
        Currency currency
    }

    %% POLÍTICAS DE TARIFAS
    FarePolicies {
        string id PK
        Currency defaultCurrency
        decimal minimumFare
        RoundingMode roundingMode
        MissingBehavior missingOriginBehavior
        MissingBehavior missingDestBehavior
        FareType defaultFareType
        decimal defaultFixedPrice
        decimal defaultBaseRate
        decimal defaultUnitRate
        datetime createdAt
        datetime updatedAt
    }

    %% USUARIOS (PARA AUDITORÍA)
    User {
        string id PK
        string email
        string name
        UserRole role
        datetime createdAt
        datetime updatedAt
    }

    %% RELACIONES
    GlobalFare ||--|| User : "createdBy"
    GlobalFare ||--o| User : "updatedBy"
    Zone ||--o{ ZoneFare : "has"
    Zone ||--o{ ZoneFareMatrix : "originZone"
    Zone ||--o{ ZoneFareMatrix : "destinationZone"
```

## 🔄 FLUJO DE CREACIÓN DE TARIFAS

### 1️⃣ TARIFAS GLOBALES (Sin Zona Geográfica)

```mermaid
flowchart TD
    A[🎯 Usuario selecciona tipo de tarifa] --> B{Tipo de Tarifa}
    
    B -->|Base Fare| C[💰 Formulario Tarifa Base]
    B -->|Per Kilometer| D[📏 Formulario Por Kilómetro]
    B -->|Per Hour| E[⏰ Formulario Por Hora]
    
    C --> F[📝 Llenar datos básicos]
    D --> G[📝 Llenar tarifa por km]
    E --> H[📝 Llenar tarifa por hora]
    
    F --> I[✅ Validar formulario]
    G --> I
    H --> I
    
    I --> J[🚀 POST /api/admin/global-fares]
    J --> K[💾 Guardar en GlobalFare]
    K --> L[🔄 Recargar tabla de tarifas]
    
    style C fill:#ffd700
    style D fill:#87ceeb
    style E fill:#dda0dd
    style K fill:#90ee90
```

### 2️⃣ TARIFAS POR ZONA (Con Polígono Geográfico)

```mermaid
flowchart TD
    A[🎯 Usuario selecciona Zone Fare] --> B[🗺️ Dibujar polígono en mapa]
    B --> C[📍 Polígono completado]
    C --> D[📝 Formulario datos de zona]
    
    D --> E[📋 Llenar información]
    E --> F{Validaciones}
    
    F -->|❌ Error| G[⚠️ Mostrar errores]
    F -->|✅ OK| H[🚀 POST /api/admin/zones]
    
    H --> I[💾 Crear Zone + ZoneFare]
    I --> J[🔄 Recargar mapa y tabla]
    
    G --> E
    
    style B fill:#98fb98
    style I fill:#90ee90
```

## 📊 TIPOS DE TARIFAS Y SUS CAMPOS

### 🌍 TARIFAS GLOBALES (GlobalFare)

| Tipo | Campos Principales | Descripción |
|------|-------------------|-------------|
| **base_fare** | `baseFare`, `currency` | Tarifa mínima global |
| **per_kilometer** | `perKmRate`, `currency`, `surgeMultiplier`, `cancellationFee` | Costo adicional por km |
| **per_hour** | `perMinuteRate`, `currency`, `surgeMultiplier`, `cancellationFee` | Costo adicional por hora |

### 🗺️ TARIFAS POR ZONA (ZoneFare)

| Tipo | Campos Principales | Descripción |
|------|-------------------|-------------|
| **zone_fare** | `baseFare`, `currency`, `surgeMultiplier`, `cancellationFee` | Tarifa fija por zona |

## 🔗 RELACIONES ENTRE SCHEMAS

```mermaid
graph LR
    A[GlobalFare] -.->|"Aplica globalmente"| B[Toda la plataforma]
    
    C[Zone] -->|"1:N"| D[ZoneFare]
    C -->|"1:N"| E[ZoneFareMatrix origen]
    C -->|"1:N"| F[ZoneFareMatrix destino]
    
    G[User] -->|"Crea"| A
    G -->|"Crea"| C
    
    H[FarePolicies] -.->|"Configura"| I[Comportamiento general]
    J[FareConfig] -.->|"Configura"| K[Tarifas por vehículo]
    
    style A fill:#e1f5fe
    style C fill:#f3e5f5
    style G fill:#fff3e0
```

## 🎯 ENDPOINTS Y OPERACIONES

### 📡 ENDPOINTS PRINCIPALES

```
🌍 TARIFAS GLOBALES:
├── POST   /api/admin/global-fares          → Crear tarifa global
├── GET    /api/admin/global-fares          → Listar tarifas globales
├── PUT    /api/admin/global-fares/:id      → Actualizar tarifa global
├── PATCH  /api/admin/global-fares/:id/toggle → Activar/desactivar
└── DELETE /api/admin/global-fares/:id      → Eliminar tarifa global

🗺️ TARIFAS POR ZONA:
├── POST   /api/admin/zones                 → Crear zona + tarifa
├── GET    /api/admin/zones                 → Listar zonas
├── PUT    /api/admin/zones/:id             → Actualizar zona
├── PATCH  /api/admin/zones/:id/toggle      → Activar/desactivar zona
└── DELETE /api/admin/zones/:id             → Eliminar zona
```

## 🔄 FLUJO DE DATOS COMPLETO

```mermaid
sequenceDiagram
    participant U as 👤 Usuario Admin
    participant F as 🖥️ Frontend
    participant A as 🔧 API
    participant D as 💾 Database
    
    Note over U,D: CREACIÓN DE TARIFA GLOBAL
    
    U->>F: 1. Selecciona tipo de tarifa
    F->>F: 2. Renderiza formulario dinámico
    U->>F: 3. Llena datos del formulario
    F->>F: 4. Valida formulario
    F->>A: 5. POST /api/admin/global-fares
    A->>A: 6. Valida datos del servidor
    A->>D: 7. INSERT INTO global_fares
    D-->>A: 8. Tarifa creada
    A-->>F: 9. Respuesta exitosa
    F->>F: 10. Actualiza tabla de tarifas
    F-->>U: 11. Notificación de éxito
    
    Note over U,D: CREACIÓN DE ZONA CON TARIFA
    
    U->>F: 1. Selecciona "Zone Fare"
    F->>F: 2. Activa modo dibujo
    U->>F: 3. Dibuja polígono en mapa
    F->>F: 4. Captura coordenadas GeoJSON
    U->>F: 5. Llena datos de zona y tarifa
    F->>A: 6. POST /api/admin/zones
    A->>D: 7. BEGIN TRANSACTION
    A->>D: 8. INSERT INTO zones
    A->>D: 9. INSERT INTO zone_fares
    A->>D: 10. COMMIT TRANSACTION
    D-->>A: 11. Zona y tarifa creadas
    A-->>F: 12. Respuesta exitosa
    F->>F: 13. Actualiza mapa y tabla
    F-->>U: 14. Notificación de éxito
```

## 🎨 DIFERENCIAS CLAVE ENTRE TIPOS DE TARIFAS

### 🌍 **TARIFAS GLOBALES**
- ✅ **NO requieren** polígono geográfico
- ✅ **Aplican** en toda la plataforma
- ✅ **Se almacenan** en tabla `global_fares`
- ✅ **Tipos**: `base_fare`, `per_kilometer`, `per_hour`

### 🗺️ **TARIFAS POR ZONA**
- ✅ **REQUIEREN** polígono geográfico
- ✅ **Aplican** solo dentro de la zona
- ✅ **Se almacenan** en tablas `zones` + `zone_fares`
- ✅ **Tipos**: `zone_fare` (tarifa fija)

## 🔧 CONFIGURACIÓN DE FORMULARIOS DINÁMICOS

```javascript
// Mapeo de tipos de tarifa a formularios
const FARE_FORM_MAPPING = {
  'base_fare': BaseFareForm,        // Solo baseFare + currency
  'per_kilometer': PerKilometerFareForm, // Solo perKmRate + extras
  'per_hour': PerHourFareForm,      // Solo perHourRate + extras
  'zone_fare': ZoneFareForm         // baseFare como tarifa fija
};

// Campos por tipo de tarifa
const FARE_FIELDS = {
  base_fare: ['baseFare', 'currency'],
  per_kilometer: ['perKmRate', 'currency', 'surgeMultiplier', 'cancellationFee'],
  per_hour: ['perHourRate', 'currency', 'surgeMultiplier', 'cancellationFee'],
  zone_fare: ['baseFare', 'currency', 'surgeMultiplier', 'cancellationFee']
};
```

## 📋 RESUMEN DE IMPLEMENTACIÓN

### ✅ **COMPLETADO**
1. **Schemas de base de datos** definidos correctamente
2. **Formularios dinámicos** para cada tipo de tarifa
3. **Separación clara** entre tarifas globales y por zona
4. **Validaciones** en frontend y backend
5. **Tabla unificada** que muestra ambos tipos de tarifas
6. **Operaciones CRUD** completas para ambos tipos

### 🎯 **CARACTERÍSTICAS CLAVE**
- **Tarifas independientes**: Base, por kilómetro y por hora son tipos separados
- **Sin confusión**: Cada tipo tiene su propio formulario sin campos innecesarios
- **Flexibilidad**: Soporte para múltiples monedas y configuraciones
- **Auditoría**: Tracking de quién crea y modifica las tarifas
- **Geolocalización**: Soporte completo para zonas geográficas con PostGIS

---

*Este diagrama muestra la arquitectura completa del sistema de tarifas, desde los schemas de base de datos hasta el flujo de creación en la interfaz de usuario.*