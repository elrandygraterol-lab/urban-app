# Informe del Sistema UrbanTaxi

**Versión:** 1.0  
**Fecha:** Abril 2026  
**Clasificación:** Interno

---

## 1. Descripción General

UrbanTaxi es una plataforma de transporte urbano bajo demanda que conecta pasajeros con conductores en tiempo real. El sistema opera en el municipio Roscio, estado Guárico, Venezuela, y está diseñado para funcionar en un contexto económico bimonetario (bolívares y dólares), con métodos de pago locales como Pago Móvil y transferencias bancarias.

La plataforma está compuesta por tres componentes principales:

| Componente | Tecnología | Usuarios |
|---|---|---|
| App Móvil | Expo / React Native | Pasajeros y Conductores |
| Panel Admin Web | Node.js / EJS / Tailwind | Administradores |
| Backend API | Express.js / TypeScript / PostgreSQL | Todos los componentes |

---

## 2. Objetivos del Sistema

### 2.1 Objetivo Principal

Proveer un servicio de transporte urbano eficiente, seguro y transparente que conecte pasajeros con conductores verificados, automatizando el cálculo de tarifas, el registro de pagos y la distribución de ganancias entre los actores del sistema.

### 2.2 Objetivos Específicos

**Para el pasajero:**
- Solicitar un viaje desde cualquier punto de la ciudad con estimación de tarifa en tiempo real
- Conocer el precio antes de confirmar el viaje, en bolívares y dólares
- Rastrear al conductor en el mapa durante el trayecto
- Pagar con el método de su preferencia (efectivo, Pago Móvil, transferencia)
- Calificar el servicio recibido

**Para el conductor:**
- Recibir solicitudes de viaje con información completa del pasajero y la ruta
- Aceptar o rechazar viajes según su disponibilidad
- Acumular ganancias automáticamente en su billetera digital
- Consultar su historial de viajes y ganancias en tiempo real
- Recibir pagos de la plataforma por sus servicios

**Para el administrador:**
- Verificar y gestionar el registro de conductores
- Configurar tarifas por zona geográfica y tipo de vehículo
- Monitorear viajes activos y estadísticas de la plataforma
- Procesar pagos a conductores
- Supervisar el estado financiero del sistema

---

## 3. Roles del Sistema

El sistema define cuatro roles con permisos diferenciados:

### Administrador
Acceso completo al panel web. Gestiona conductores, tarifas, zonas geográficas, pagos manuales y reportes. Es el único rol con capacidad de verificar conductores y modificar la configuración de tarifas.

### Conductor (Driver)
Accede a la app móvil para recibir solicitudes de viaje. Debe pasar por un proceso de verificación de documentos antes de poder operar. Acumula ganancias en su billetera digital y puede configurar sus datos bancarios para recibir pagos.

### Pasajero (Passenger)
Accede a la app móvil para solicitar viajes. Puede gestionar sus métodos de pago, ver su historial de viajes y calificar conductores. Acumula puntos de lealtad por cada viaje completado.

### Propietario de Tienda (Owner)
Rol complementario para el módulo de comercios locales integrado en la plataforma. Gestiona la información de su negocio y atiende reseñas de clientes.

---

## 4. Flujo de un Viaje

El ciclo de vida de un viaje atraviesa los siguientes estados:

```
pending → accepted → arrived → in_progress → completed
                                            ↘ cancelled
```

### Paso 1 — Solicitud del pasajero
El pasajero abre la app, ingresa su destino y el sistema calcula una tarifa estimada usando el motor de tarifas por zonas. El pasajero confirma la solicitud seleccionando el tipo de vehículo (taxi o moto-taxi).

### Paso 2 — Búsqueda de conductor
El backend usa PostGIS para localizar conductores verificados y disponibles en el área. Se envían notificaciones push y por WebSocket a los conductores más cercanos. Cada conductor tiene 30 segundos para aceptar o rechazar.

### Paso 3 — Viaje en curso
Una vez aceptado, el conductor se dirige al punto de recogida. La app del pasajero muestra la ubicación del conductor en tiempo real (actualización cada 5 segundos vía WebSocket). Al llegar, el conductor marca la llegada y el pasajero sube al vehículo.

### Paso 4 — Finalización y pago
Al llegar al destino, el conductor completa el viaje. El sistema calcula la tarifa final con base en la distancia y duración reales. El pasajero realiza el pago con su método preferido. El sistema registra el pago, descuenta la comisión de la plataforma y acredita las ganancias en la billetera del conductor.

### Paso 5 — Calificación mutua
Pasajero y conductor se califican mutuamente (1 a 5 estrellas). Las calificaciones se promedian en los perfiles y afectan la visibilidad del conductor en futuras búsquedas.

---

## 5. Sistema de Tarifas

El motor de tarifas es uno de los componentes más complejos del sistema. Implementa una jerarquía de cuatro niveles para garantizar que siempre exista un precio para cualquier viaje.

### 5.1 Jerarquía de Prioridad

| Nivel | Fuente | Condición |
|---|---|---|
| 1 — Más específico | Matriz zona-a-zona | Existe entrada para Origen → Destino |
| 2 | Tarifa de zona origen | Origen detectado, sin entrada en matriz |
| 3 | Tarifa de zona destino | Destino detectado, origen fuera de cobertura |
| 4 — Más general | Tarifa base global | Ninguna zona detectada |

### 5.2 Tipos de Tarifa

**Por Zona (ZONA):** Precio fijo independiente de distancia y tiempo. Ideal para áreas pequeñas o rutas estandarizadas.

**Por Kilómetro (KILOMETRO):** `precio = tarifa_base + (precio_por_km × distancia_km)`. Para viajes donde la distancia es el factor principal.

**Por Hora (HORA):** `precio = tarifa_base + (precio_por_hora × duración_horas)`. Para servicios de espera o trayectos lentos.

**Recargo por Horario (time_surcharge):** Recargo adicional (porcentaje o monto fijo) que se aplica automáticamente en franjas horarias configuradas, como tarifa nocturna.

**Tarifa de Cancelación (cancellation_fare):** Monto cobrado al pasajero cuando cancela un viaje ya aceptado por el conductor.

### 5.3 Soporte Bimonetario

Todas las tarifas soportan bolívares (VES) y dólares (USD). El sistema obtiene la tasa de cambio BCV diariamente desde la API `ve.dolarapi.com` y la usa para mostrar precios duales en tiempo real en el panel admin y en la app. La conversión se aplica automáticamente al cambiar la moneda de una tarifa.

### 5.4 Zonas Geográficas

Las zonas se definen como polígonos geográficos usando PostGIS. El sistema detecta automáticamente en qué zona se encuentra el punto de recogida y el destino del pasajero para aplicar la tarifa correspondiente. El panel admin permite dibujar zonas directamente sobre el mapa.

---

## 6. Sistema de Pagos

### 6.1 Métodos de Pago Disponibles

| Método | Descripción | Contexto |
|---|---|---|
| Efectivo (cash) | Pago directo al conductor | Universal |
| Pago Móvil | Transferencia bancaria instantánea | Venezuela |
| Transferencia bancaria | Transferencia tradicional | Venezuela |
| Tarjeta de crédito | Tokenización segura | Internacional |
| Billetera digital | Saldo prepagado en la plataforma | Plataforma |

### 6.2 Estructura de un Pago

Cada viaje completado genera un registro de pago con la siguiente distribución:

```
Monto total del viaje
    ├── Comisión de plataforma (~20%)  → Ingresos de UrbanTaxi
    └── Ganancias del conductor (~80%) → Billetera del conductor
```

### 6.3 Billetera del Conductor

Cada conductor verificado tiene una billetera digital en la plataforma. Al completar un viaje, las ganancias se acreditan automáticamente. El conductor puede consultar su saldo y el historial de transacciones desde la app. Los retiros se procesan mediante pagos manuales gestionados por el administrador.

### 6.4 Pagos Manuales

El sistema incluye un módulo de pagos manuales que permite al administrador transferir fondos a los conductores. El flujo es:

1. Admin selecciona el conductor y el monto a pagar
2. El sistema recupera automáticamente los datos bancarios del conductor (registrados en su perfil)
3. Admin confirma el pago y el sistema genera un número de referencia
4. El estado del pago pasa de `pending` a `completed`
5. Se registra la transacción en el historial

---

## 7. Por Qué se Necesitan Pagos Automatizados

### 7.1 El Problema Actual

En un modelo de taxi tradicional, el conductor recibe el pago directamente del pasajero en efectivo. Esto genera varios problemas:

- La plataforma no puede retener su comisión automáticamente
- No hay registro centralizado de transacciones
- El conductor no tiene visibilidad de sus ganancias acumuladas
- El administrador no puede auditar los ingresos del sistema
- Los reembolsos por cancelaciones son imposibles de gestionar

### 7.2 Lo que Resuelve la Automatización

**Retención automática de comisión:** Cada vez que se completa un viaje, el sistema calcula y separa la comisión de la plataforma sin intervención manual. Esto garantiza que UrbanTaxi reciba su porcentaje en cada transacción.

**Trazabilidad completa:** Cada bolívar que entra y sale del sistema queda registrado con su origen (viaje), destino (conductor o plataforma), fecha y método. Esto permite auditorías precisas y resolución de disputas.

**Ganancias en tiempo real:** El conductor ve sus ganancias acumuladas inmediatamente después de completar cada viaje, sin esperar a que el administrador procese pagos manualmente.

**Escalabilidad:** Con pagos manuales, gestionar 10 conductores es manejable. Con 100 o 500 conductores, se vuelve inviable. La automatización permite crecer sin aumentar la carga administrativa.

**Reembolsos automáticos:** Si un viaje se cancela después de ser aceptado, el sistema puede aplicar la tarifa de cancelación y procesar el reembolso correspondiente sin intervención humana.

**Contexto venezolano:** En Venezuela, los pagos digitales (Pago Móvil, transferencias) son el método predominante. Automatizar la integración con estos métodos es esencial para que la plataforma sea funcional en el mercado local.

### 7.3 Estado Actual vs. Estado Objetivo

| Aspecto | Estado Actual | Estado Objetivo |
|---|---|---|
| Comisión de plataforma | Calculada automáticamente, registrada en BD | ✅ Implementado |
| Billetera del conductor | Acumulación automática por viaje | ✅ Implementado |
| Pagos a conductores | Manual vía admin (Pago Móvil / transferencia) | ⚠️ Semi-automatizado |
| Integración con gateway de pago | Estructura preparada, sin gateway real conectado | 🔲 Pendiente |
| Pagos con tarjeta del pasajero | Tokenización implementada, sin procesador real | 🔲 Pendiente |
| Reembolsos automáticos | Modelo en BD, lógica pendiente | 🔲 Pendiente |

---

## 8. Arquitectura Técnica

### 8.1 Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Base de datos | PostgreSQL + PostGIS (geolocalización) |
| ORM | Prisma 5.x |
| Backend | Express.js + TypeScript |
| Tiempo real | Socket.io (WebSocket) |
| App móvil | Expo + React Native |
| Panel admin | EJS + Tailwind CSS |
| Notificaciones push | Expo Push Notifications |
| Mapas y rutas | Leaflet (admin), OSRM (rutas), Nominatim (geocoding) |
| Tasa de cambio | API ve.dolarapi.com (BCV) |
| Monitoreo | Prometheus + Grafana |
| Autenticación | JWT + bcrypt |

### 8.2 Modelos de Datos Principales

```
User ──────────────── PassengerProfile ── Ride ── Payment ── WalletTransaction
     └─────────────── DriverProfile ─────┘         │              │
                           │                        │          Wallet
                           └── ManualPayment        └── Refund

Zone ── ZoneFare
     └── ZoneFareMatrix (origen → destino)

GlobalFare (base_fare, time_surcharge, cancellation_fare)
```

### 8.3 Flujo de Datos en Tiempo Real

```
App Pasajero                Backend                    App Conductor
     │                         │                            │
     │── solicitar viaje ──────►│                            │
     │                         │── buscar conductores ──────►│
     │                         │◄── aceptar viaje ──────────│
     │◄── conductor asignado ──│                            │
     │                         │◄── actualizar ubicación ───│ (cada 5s)
     │◄── ubicación conductor ─│                            │
     │                         │◄── completar viaje ────────│
     │◄── modal de pago ───────│                            │
     │── confirmar pago ───────►│                            │
     │                         │── acreditar ganancias ─────►│ (Wallet)
     │◄── calificación ────────│                            │
```

---

## 9. Módulo de Comercios (Store)

La plataforma incluye un módulo complementario de directorio de comercios locales. Los propietarios de negocios pueden registrar sus tiendas, subir fotos y gestionar reseñas de clientes. Este módulo no está directamente relacionado con el servicio de transporte pero aprovecha la base de usuarios de la plataforma para ofrecer visibilidad a negocios locales.

---

## 10. Pendientes y Próximos Pasos

### Prioridad Alta

1. **Integración con gateway de pago real** — Conectar un procesador de pagos (Stripe, PayPal, o una solución local venezolana) para procesar pagos con tarjeta y billetera digital de forma automática.

2. **Automatización de pagos a conductores** — Implementar la lógica para que el sistema procese automáticamente los retiros de la billetera del conductor a su cuenta bancaria o Pago Móvil, sin intervención manual del administrador.

3. **Tarifas por kilómetro y por minuto** — La lógica de cálculo existe en el backend pero la configuración desde el panel admin está deshabilitada temporalmente. Habilitar y probar estos tipos de tarifa.

### Prioridad Media

4. **Reembolsos automáticos** — Implementar la lógica de reembolso cuando un viaje es cancelado después de ser aceptado, aplicando la tarifa de cancelación configurada.

5. **Historial de viajes en la app** — Completar la pantalla de historial de viajes para pasajeros y conductores con filtros por fecha y estado.

6. **Notificaciones de pago** — Enviar notificación push al conductor cuando se acrediten ganancias en su billetera.

### Prioridad Baja

7. **Programa de lealtad** — Implementar la lógica de puntos de lealtad para pasajeros (el campo existe en la BD pero no tiene lógica de negocio).

8. **Reportes exportables** — Agregar exportación a CSV/PDF de reportes financieros desde el panel admin.

---

## 11. Conclusión

UrbanTaxi es un sistema de transporte urbano funcional con una arquitectura sólida y bien estructurada. El núcleo del servicio — solicitud de viajes, asignación de conductores, cálculo de tarifas y registro de pagos — está implementado y operativo.

El principal desafío pendiente es la automatización completa del ciclo de pagos: conectar un procesador de pagos real para los pasajeros y automatizar los retiros de los conductores. Esto eliminaría la dependencia de pagos manuales y permitiría escalar la plataforma sin aumentar la carga operativa del equipo administrativo.

El soporte bimonetario (VES/USD) con conversión automática usando la tasa BCV es una característica diferenciadora importante para el mercado venezolano, donde la dolarización parcial de la economía hace necesario mostrar precios en ambas monedas.

---

*Documento generado a partir del análisis del código fuente del sistema UrbanTaxi.*
