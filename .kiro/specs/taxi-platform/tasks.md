# Plan de Implementación: Plataforma de Taxis y Moto-Taxis

## Resumen

Este plan de implementación cubre el desarrollo completo de la plataforma de taxis y moto-taxis, incluyendo una aplicación móvil unificada multiplataforma (Expo + React Native) con roles de pasajero y conductor, backend (Express + PostgreSQL + Redis), y dashboard administrativo web. La implementación sigue un enfoque incremental, priorizando funcionalidad core antes de características opcionales.

**Nota importante**: La aplicación móvil es una sola app que soporta ambos roles (pasajero y conductor) con navegación condicional basada en el rol del usuario. Esto resulta en 2 builds totales: 1 para Android (.apk) y 1 para iOS (.ipa).

## Stack Tecnológico

- **Frontend**: Expo SDK 50+, React Native, React Navigation, Zustand
- **Diseño**: UrbanTaxi brand (green #00B300, orange #FF9500 palette)
- **Backend**: Node.js 18+, Express.js, PostgreSQL 15+ con PostGIS, Redis 7+
- **Autenticación**: JWT con refresh tokens
- **Mapas**: react-native-maps, Google Maps API
- **Notificaciones**: expo-notifications, Firebase Cloud Messaging
- **Tiempo Real**: Socket.io
- **Testing**: Jest, fast-check (property-based testing)
- **Despliegue**: EAS Build, Google Play, App Store, Vercel/Netlify

## Tareas

- [ ] 1. Configuración inicial del proyecto
  - [x] 1.1 Configurar proyecto Expo con TypeScript
    - Inicializar proyecto con `npx create-expo-app taxi-platform --template`
    - Configurar TypeScript, ESLint, Prettier
    - Configurar estructura de carpetas (app/(auth), app/(passenger), app/(driver), components/, store/)
    - Instalar dependencias base: React Navigation, Zustand, Axios, Socket.io-client
    - Crear archivo de tema con paleta de colores UrbanTaxi (constants/theme.ts)
    - Configurar navegación condicional basada en rol de usuario (passenger/driver)
    - _Requisitos: Todos, 29_

  - [x] 1.2 Configurar proyecto backend con Express
    - Inicializar proyecto Node.js con TypeScript
    - Configurar Express con middleware básico (cors, helmet, compression)
    - Configurar estructura de carpetas (src/services, src/controllers, src/models, src/middleware)
    - Instalar dependencias: Express, Prisma/TypeORM, bcrypt, jsonwebtoken, Socket.io, Zod
    - Configurar variables de entorno con dotenv
    - _Requisitos: Todos_

  - [x] 1.3 Configurar base de datos PostgreSQL con docker
    - Crear esquema de base de datos según diseño
    - Configurar PostGIS para consultas geoespaciales
    - Configurar Prisma/TypeORM con modelos de datos
    - Crear migraciones iniciales para todas las tablas
    - Configurar índices para optimización de consultas
    - _Requisitos: Todos_

  - [x] 1.4 Configurar Redis para caché y pub/sub
    - Instalar y configurar cliente Redis
    - Configurar conexión con manejo de errores
    - Implementar utilidades para caché y pub/sub
    - _Requisitos: 7, 14, 17_

  - [-]\* 1.5 Configurar framework de testing
    - Configurar Jest para backend y frontend
    - Configurar fast-check para property-based testing
    - Crear utilidades de testing (mocks, fixtures)
    - Configurar coverage reporting
    - _Requisitos: Todos_

- [ ] 2. Implementar servicio de autenticación
  - [x] 2.1 Crear modelos de datos de usuarios
    - Implementar modelo User con validaciones
    - Implementar modelo PassengerProfile
    - Implementar modelo DriverProfile
    - Crear DTOs para registro y login
    - _Requisitos: 1.1, 2.1, 2.2, 3.1_

  - [x] 2.2 Implementar registro de pasajeros
    - Crear endpoint POST /api/auth/register/passenger
    - Validar formato de email, teléfono y contraseña
    - Hash de contraseñas con bcrypt
    - Verificar unicidad de email y teléfono
    - Crear cuenta de pasajero en base de datos
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x]\* 2.3 Property test: Valid Registration Creates Account
    - **Propiedad 1: Valid Registration Creates Account**
    - **Valida: Requisitos 1.2, 1.4, 1.5, 1.6**

  - [x]\* 2.4 Property test: Duplicate Credentials Rejected
    - **Propiedad 2: Duplicate Credentials Rejected**
    - **Valida: Requisito 1.3**

  - [x] 2.5 Implementar login de usuarios
    - Crear endpoint POST /api/auth/login
    - Validar credenciales contra base de datos
    - Generar JWT access token y refresh token
    - Implementar expiración de tokens (24 horas)
    - Almacenar refresh tokens en Redis
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x]\* 2.6 Property test: Authentication Token Generation
    - **Propiedad 3: Authentication Token Generation**
    - **Valida: Requisito 2.3**

  - [x]\* 2.7 Property test: Invalid Credentials Rejected
    - **Propiedad 4: Invalid Credentials Rejected**
    - **Valida: Requisito 2.4**

  - [x] 2.8 Implementar recuperación de contraseña
    - Crear endpoint POST /api/auth/forgot-password
    - Generar token de recuperación con expiración
    - Enviar email con enlace de recuperación
    - Crear endpoint POST /api/auth/reset-password
    - Validar token y actualizar contraseña
    - _Requisitos: 2.6_

  - [x]\* 2.9 Property test: Password Recovery Token Generation
    - **Propiedad 5: Password Recovery Token Generation**
    - **Valida: Requisito 2.6**

  - [x] 2.10 Implementar middleware de autenticación
    - Crear middleware para validar JWT tokens
    - Implementar verificación de roles (passenger, driver, admin)
    - Manejar tokens expirados y refresh token rotation
    - _Requisitos: 2.3, 2.5_

  - [x]\* 2.11 Property test: Password Hashing
    - **Propiedad 43: Password Hashing**
    - **Valida: Requisito 24.1**

- [ ] 3. Checkpoint - Verificar autenticación
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ] 4. Implementar registro y verificación de conductores
  - [x] 4.1 Implementar registro de conductores
    - Crear endpoint POST /api/auth/register/driver
    - Validar datos de conductor y vehículo
    - Crear perfil de conductor con estado "pending"
    - Almacenar información del vehículo
    - _Requisitos: 3.1, 3.2_

  - [-]\* 4.2 Property test: Driver Registration Creates Pending Account
    - **Propiedad 6: Driver Registration Creates Pending Account**
    - **Valida: Requisito 3.2**

  - [x] 4.3 Implementar carga de documentos de verificación
    - Crear endpoint POST /api/users/drivers/:id/documents
    - Integrar con S3/Cloudinary para almacenamiento
    - Validar tipos de documentos requeridos
    - Actualizar estado a "pending verification" cuando estén completos
    - _Requisitos: 3.3, 3.4, 3.5_

  - [ ]\* 4.4 Property test: Document Completeness Validation
    - **Propiedad 7: Document Completeness Validation**
    - **Valida: Requisito 3.4**

  - [ ]\* 4.5 Property test: Document Upload Triggers Verification Status
    - **Propiedad 8: Document Upload Triggers Verification Status**
    - **Valida: Requisito 3.5**

  - [x] 4.6 Implementar verificación de conductores por admin
    - Crear endpoint GET /api/admin/drivers/pending-verification
    - Crear endpoint PUT /api/users/drivers/:id/verify
    - Implementar aprobación con cambio de estado a "verified"
    - Implementar rechazo con almacenamiento de razón
    - Enviar notificaciones de aprobación/rechazo
    - _Requisitos: 4.1, 4.2, 4.3, 4.4_

  - [ ]\* 4.7 Property test: Admin Approval Changes Driver Status
    - **Propiedad 10: Admin Approval Changes Driver Status**
    - **Valida: Requisito 4.3**

  - [ ]\* 4.8 Property test: Admin Rejection Stores Reason
    - **Propiedad 11: Admin Rejection Stores Reason**
    - **Valida: Requisito 4.4**

  - [x] 4.9 Implementar actualización de documentos
    - Crear endpoint para actualizar documentos existentes
    - Cambiar estado a "pending re-verification"
    - Permitir aceptar viajes durante re-verificación
    - Notificar a administradores
    - _Requisitos: 23.1, 23.2, 23.3, 23.4, 23.5_

  - [ ]\* 4.10 Property test: Document Update Triggers Re-verification
    - **Propiedad 41: Document Update Triggers Re-verification**
    - **Valida: Requisitos 23.2, 23.3, 23.5**

- [ ] 5. Implementar gestión de usuarios
  - [x] 5.1 Implementar endpoints de gestión de pasajeros
    - Crear GET /api/users/passengers (lista con paginación)
    - Crear GET /api/users/passengers/:id (detalle)
    - Crear PUT /api/users/passengers/:id (actualización)
    - Crear DELETE /api/users/passengers/:id (eliminación)
    - _Requisitos: 13.1, 13.4_

  - [x] 5.2 Implementar endpoints de gestión de conductores
    - Crear GET /api/users/drivers (lista con paginación)
    - Crear GET /api/users/drivers/:id (detalle)
    - Crear PUT /api/users/drivers/:id (actualización)
    - _Requisitos: 13.2, 13.4_

  - [x] 5.3 Implementar búsqueda de usuarios
    - Crear endpoint GET /api/users/search
    - Implementar búsqueda por nombre, email, teléfono
    - Búsqueda case-insensitive con ILIKE
    - _Requisitos: 13.3_

  - [ ]\* 5.4 Property test: User Search Functionality
    - **Propiedad 26: User Search Functionality**
    - **Valida: Requisito 13.3**

  - [x] 5.5 Implementar suspensión y reactivación de cuentas
    - Crear endpoint PUT /api/users/:id/suspend
    - Crear endpoint PUT /api/users/:id/reactivate
    - Bloquear acceso a usuarios suspendidos en middleware
    - _Requisitos: 13.5, 13.6, 13.7_

  - [ ]\* 5.6 Property test: Account Suspension Blocks Access
    - **Propiedad 27: Account Suspension Blocks Access**
    - **Valida: Requisitos 13.5, 13.7**

  - [ ]\* 5.7 Property test: Account Reactivation Restores Access
    - **Propiedad 28: Account Reactivation Restores Access**
    - **Valida: Requisito 13.6**

  - [x] 5.8 Implementar eliminación de cuenta y datos
    - Crear endpoint DELETE /api/users/me
    - Eliminar o anonimizar datos personales
    - Cumplir con GDPR/derecho al olvido
    - _Requisitos: 24.5_

  - [ ]\* 5.9 Property test: Account Deletion Removes Data
    - **Propiedad 45: Account Deletion Removes Data**
    - **Valida: Requisito 24.5**

- [ ] 6. Checkpoint - Verificar gestión de usuarios
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ] 7. Implementar configuración de tarifas
  - [x] 7.1 Crear modelo y endpoints de configuración de tarifas
    - Implementar modelo FareConfig
    - Crear GET /api/admin/fare-config
    - Crear PUT /api/admin/fare-config
    - Almacenar configuración por tipo de vehículo
    - _Requisitos: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 7.2 Implementar algoritmo de cálculo de tarifas
    - Crear función calculateFare(distance, duration, vehicleType)
    - Aplicar tarifa base + tarifa por km + tarifa por minuto
    - Implementar surge pricing (multiplicador en horas pico)
    - Redondear a 2 decimales
    - _Requisitos: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7_

  - [ ]\* 7.3 Property test: Fare Calculation Includes All Components
    - **Propiedad 12: Fare Calculation Includes All Components**
    - **Valida: Requisitos 5.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7**

  - [ ]\* 7.4 Property test: Fare Configuration Persistence
    - **Propiedad 29: Fare Configuration Persistence**
    - **Valida: Requisitos 15.1, 15.2, 15.3, 15.4, 15.5, 15.6**

  - [x] 7.5 Implementar configuración de comisión y tarifas de cancelación
    - Agregar campo platform_commission_percentage
    - Agregar campo cancellation_fee
    - Crear endpoint para actualizar estas configuraciones
    - _Requisitos: 15.4, 21.6_

  - [ ]\* 7.6 Property test: Cancellation Fee Configuration
    - **Propiedad 39: Cancellation Fee Configuration**
    - **Valida: Requisito 21.6**

- [ ] 8. Implementar servicio de viajes (core)
  - [x] 8.1 Implementar algoritmo de búsqueda de conductores cercanos
    - Crear función findNearbyDrivers(location, vehicleType, radius)
    - Usar PostGIS ST_DWithin para consulta geoespacial
    - Filtrar por disponibilidad y verificación
    - Ordenar por distancia y rating
    - _Requisitos: 5.6, 6.1_

  - [ ]\* 8.2 Property test: Geospatial Filtering of Drivers
    - **Propiedad 14: Geospatial Filtering of Drivers**
    - **Valida: Requisito 5.6**

  - [x] 8.3 Implementar creación de solicitud de viaje
    - Crear endpoint POST /api/rides/request
    - Validar datos de pickup y destino
    - Calcular distancia y duración estimada con Google Maps API
    - Calcular tarifa estimada
    - Crear registro de viaje con estado "pending"
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.7, 8.1_

  - [ ]\* 8.4 Property test: Ride Request Creates Ride and Notifies Drivers
    - **Propiedad 13: Ride Request Creates Ride and Notifies Drivers**
    - **Valida: Requisitos 5.5, 8.1**

  - [x] 8.5 Implementar notificación a conductores cercanos
    - Buscar conductores disponibles en radio de 5km
    - Enviar notificaciones push a top 10 conductores
    - Ordenar por rating y distancia
    - Implementar timeout de 2 minutos para cancelación automática
    - _Requisitos: 5.5, 5.6, 6.1, 6.7_

  - [x] 8.6 Implementar aceptación de viaje por conductor
    - Crear endpoint POST /api/rides/:id/accept
    - Validar que conductor esté verificado
    - Cambiar estado de viaje a "accepted"
    - Asignar conductor al viaje
    - Notificar al pasajero con datos del conductor
    - Cancelar notificaciones a otros conductores
    - _Requisitos: 6.2, 6.3, 6.4, 6.5, 8.2_

  - [ ]\* 8.7 Property test: Driver Acceptance Assigns Ride
    - **Propiedad 15: Driver Acceptance Assigns Ride**
    - **Valida: Requisitos 6.3, 6.4, 8.2**

  - [ ]\* 8.8 Property test: Assignment Cancels Other Notifications
    - **Propiedad 16: Assignment Cancels Other Notifications**
    - **Valida: Requisito 6.5**

  - [ ]\* 8.9 Property test: Unverified Drivers Cannot Accept Rides
    - **Propiedad 9: Unverified Drivers Cannot Accept Rides**
    - **Valida: Requisitos 3.6, 4.5**

  - [x] 8.10 Implementar rechazo de viaje por conductor
    - Crear endpoint POST /api/rides/:id/reject
    - Mantener viaje en estado "pending"
    - Continuar notificando a otros conductores
    - _Requisitos: 6.6_

- [ ] 9. Checkpoint - Verificar creación y asignación de viajes
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ] 10. Implementar estados y ciclo de vida del viaje
  - [x] 10.1 Implementar transiciones de estado del viaje
    - Crear endpoint POST /api/rides/:id/arrive (conductor llegó a pickup)
    - Crear endpoint POST /api/rides/:id/start (iniciar viaje)
    - Crear endpoint POST /api/rides/:id/complete (completar viaje)
    - Validar transiciones de estado válidas
    - Actualizar timestamps correspondientes
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]\* 10.2 Property test: Ride State Machine Transitions
    - **Propiedad 17: Ride State Machine Transitions**
    - **Valida: Requisitos 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7**

  - [x] 10.3 Implementar cancelación de viajes
    - Crear endpoint POST /api/rides/:id/cancel
    - Validar que cancelación sea permitida según estado
    - Calcular tarifa de cancelación si aplica
    - Almacenar razón y quién canceló
    - Notificar a la otra parte
    - _Requisitos: 8.6, 8.7, 21.1, 21.2, 21.3, 21.4, 21.5_

  - [ ]\* 10.4 Property test: Cancellation Allowed by State
    - **Propiedad 36: Cancellation Allowed by State**
    - **Valida: Requisitos 21.1, 21.2, 8.6**

  - [ ]\* 10.5 Property test: Late Cancellation Fee Applied
    - **Propiedad 37: Late Cancellation Fee Applied**
    - **Valida: Requisitos 21.3, 21.5**

  - [ ]\* 10.6 Property test: Driver Cancellation Triggers Re-request
    - **Propiedad 38: Driver Cancellation Triggers Re-request**
    - **Valida: Requisito 21.4**

  - [x] 10.7 Implementar cálculo de tarifa final
    - Calcular distancia y duración real del viaje
    - Aplicar fórmula de tarifa con valores reales
    - Actualizar campo final_fare al completar viaje
    - _Requisitos: 9.7_

- [ ] 11. Implementar seguimiento en tiempo real con WebSockets
  - [x] 11.1 Configurar Socket.io en backend
    - Configurar servidor Socket.io con Express
    - Implementar autenticación de WebSocket con JWT
    - Configurar rooms por viaje (ride:${rideId})
    - Configurar Redis adapter para multi-servidor
    - _Requisitos: 7.1, 7.2, 7.3, 7.4_

  - [x] 11.2 Implementar actualización de ubicación del conductor
    - Crear evento driver:location_update
    - Actualizar ubicación en base de datos
    - Broadcast a pasajero en room del viaje
    - Actualizar cada 5 segundos desde app
    - _Requisitos: 7.1, 7.2_

  - [x] 11.3 Implementar cálculo de ETA
    - Crear función calculateETA(currentLocation, destination)
    - Usar Google Maps Distance Matrix API(esta opcion es buena pero me pide registrarme con tarjeta de credito y no tengo , requiero de otra opcion de pruebas y gratis)
    - Considerar tráfico en tiempo real
    - Emitir evento ride:eta_update al pasajero
    - _Requisitos: 7.3, 7.5_

  - [ ]\* 11.4 Property test: ETA Calculation for Active Rides
    - **Propiedad 18: ETA Calculation for Active Rides**
    - **Valida: Requisito 7.5**

  - [x] 11.5 Implementar eventos de cambio de estado
    - Emitir ride:status_changed cuando cambie estado
    - Emitir ride:accepted con datos del conductor
    - Emitir ride:completed cuando termine viaje
    - Emitir ride:cancelled cuando se cancele
    - _Requisitos: 6.4, 8.2, 8.3, 8.4, 8.5_

- [ ] 12. Implementar disponibilidad de conductores
  - [x] 12.1 Implementar toggle de disponibilidad
    - Crear endpoint PUT /api/drivers/availability
    - Actualizar campo is_available en driver_profiles
    - Emitir evento driver:availability_changed
    - Excluir conductores no disponibles de matching
    - _Requisitos: 19.1, 19.2, 19.3, 19.4_

  - [ ]\* 12.2 Property test: Driver Availability Controls Matching
    - **Propiedad 35: Driver Availability Controls Matching**
    - **Valida: Requisitos 19.2, 19.3, 19.5**

  - [x] 12.3 Implementar auto-unavailable durante viaje activo
    - Cambiar disponibilidad a false cuando acepte viaje
    - Restaurar disponibilidad cuando complete viaje
    - _Requisitos: 19.5_

- [ ] 13. Checkpoint - Verificar ciclo completo de viaje
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ] 14. Implementar sistema de pagos
  - [x] 14.1 Implementar gestión de métodos de pago
    - Crear modelo PaymentMethod
    - Crear GET /api/payments/methods (listar métodos)
    - Crear POST /api/payments/methods (agregar método)
    - Crear DELETE /api/payments/methods/:id (eliminar método)
    - Soportar efectivo, tarjeta, billetera digital
    - _Requisitos: 10.1, 10.2_

  - [ ]\* 14.2 Property test: Payment Method Support
    - **Propiedad 19: Payment Method Support**
    - **Valida: Requisito 10.2**

  - [x] 14.3 Implementar procesamiento de pagos
    - Crear endpoint POST /api/payments/process
    - Integrar con pasarela de pagos (Stripe o local)
    - Manejar pagos en efectivo (marcar como pendiente)
    - Procesar pagos con tarjeta automáticamente
    - Calcular comisión de plataforma
    - Calcular ganancias del conductor
    - _Requisitos: 10.3, 10.4, 10.5, 12.6_

  - [ ]\* 14.4 Property test: Automatic Payment Processing
    - **Propiedad 20: Automatic Payment Processing**
    - **Valida: Requisito 10.5**

  - [ ]\* 14.5 Property test: Driver Earnings Calculation
    - **Propiedad 25: Driver Earnings Calculation**
    - **Valida: Requisito 12.6**

  - [x] 14.6 Implementar manejo de fallos de pago
    - Detectar fallos en procesamiento
    - Notificar al pasajero
    - Crear endpoint para reintentar pago
    - Almacenar respuesta de pasarela en JSONB
    - _Requisitos: 10.6_

  - [ ]\* 14.7 Property test: Failed Payment Notification
    - **Propiedad 21: Failed Payment Notification**
    - **Valida: Requisito 10.6**

  - [x] 14.8 Implementar generación de recibos
    - Crear endpoint GET /api/payments/receipts/:rideId
    - Generar PDF o HTML con detalles del pago
    - Enviar recibo por email usando SendGrid/SES
    - _Requisitos: 10.7_

  - [ ]\* 14.9 Property test: Payment Receipt Generation
    - **Propiedad 22: Payment Receipt Generation**
    - **Valida: Requisito 10.7**

  - [x] 14.10 Implementar seguridad de datos de pago
    - Tokenizar números de tarjeta con pasarela
    - Nunca almacenar números completos
    - Mostrar solo últimos 4 dígitos
    - Cumplir con PCI-DSS
    - _Requisitos: 24.3, 24.4_

  - [ ]\* 14.11 Property test: Card Number Masking
    - **Propiedad 44: Card Number Masking**
    - **Valida: Requisito 24.4**

- [ ] 15. Implementar sistema de valoraciones
  - [x] 15.1 Implementar valoración de conductores y pasajeros
    - Crear modelo Rating
    - Crear POST /api/ratings/driver (pasajero valora conductor)
    - Crear POST /api/ratings/passenger (conductor valora pasajero)
    - Validar rating entre 1 y 5
    - Permitir comentarios opcionales
    - Mostrar prompt después de completar viaje
    - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]\* 15.2 Property test: Rating Value Validation
    - **Propiedad 23: Rating Value Validation**
    - **Valida: Requisitos 11.2, 11.5**

  - [x] 15.3 Implementar cálculo de rating promedio
    - Calcular promedio al recibir nueva valoración
    - Actualizar average_rating en perfiles
    - Redondear a 2 decimales
    - Mostrar rating en perfil de conductor
    - _Requisitos: 11.6, 11.7_

  - [ ]\* 15.4 Property test: Average Rating Calculation
    - **Propiedad 24: Average Rating Calculation**
    - **Valida: Requisito 11.6**

  - [x] 15.5 Implementar consulta de valoraciones
    - Crear GET /api/ratings/driver/:id
    - Crear GET /api/ratings/passenger/:id
    - Incluir comentarios y fechas
    - _Requisitos: 11.6_

- [ ] 16. Checkpoint - Verificar pagos y valoraciones
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ] 17. Implementar sistema de notificaciones push
  - [x] 17.1 Configurar Firebase Cloud Messaging
    - Configurar proyecto Firebase
    - Integrar Firebase Admin SDK en backend
    - Configurar credenciales de servicio
    - _Requisitos: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

  - [x] 17.2 Implementar registro de tokens de dispositivos
    - Crear modelo NotificationToken
    - Crear POST /api/notifications/register-device
    - Almacenar tokens por usuario y plataforma
    - Manejar múltiples dispositivos por usuario
    - _Requisitos: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

  - [x] 17.3 Implementar envío de notificaciones
    - Crear función sendPushNotification(userId, payload)
    - Enviar a todos los dispositivos activos del usuario
    - Manejar tokens inválidos/expirados
    - Implementar reintentos para fallos temporales
    - _Requisitos: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

  - [ ]\* 17.4 Property test: Critical Events Trigger Notifications
    - **Propiedad 32: Critical Events Trigger Notifications**
    - **Valida: Requisitos 17.1, 17.2, 17.3, 17.4, 17.5, 17.6**

  - [x] 17.5 Implementar preferencias de notificaciones
    - Crear PUT /api/notifications/preferences
    - Almacenar preferencias en perfil de usuario
    - Respetar preferencias al enviar notificaciones
    - _Requisitos: 17.7_

  - [ ]\* 17.6 Property test: Notification Preferences Respected
    - **Propiedad 33: Notification Preferences Respected**
    - **Valida: Requisito 17.7**

- [ ] 18. Implementar historial de viajes
  - [x] 18.1 Implementar endpoints de historial
    - Crear GET /api/rides/history (para pasajeros y conductores)
    - Incluir paginación
    - Ordenar por fecha descendente
    - Incluir detalles completos del viaje
    - _Requisitos: 18.1, 18.2, 18.4, 18.5_

  - [x] 18.2 Implementar filtrado por fecha
    - Agregar parámetros startDate y endDate
    - Filtrar viajes en rango de fechas
    - Validar formato de fechas
    - _Requisitos: 18.3_

  - [ ]\* 18.3 Property test: Ride History Filtering
    - **Propiedad 34: Ride History Filtering**
    - **Valida: Requisito 18.3**

- [ ] 19. Implementar panel de ganancias para conductores
  - [x] 19.1 Implementar endpoints de ganancias
    - Crear GET /api/drivers/earnings/today
    - Crear GET /api/drivers/earnings/week
    - Crear GET /api/drivers/earnings/month
    - Calcular suma de earnings de viajes completados
    - Incluir número de viajes completados
    - _Requisitos: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 19.2 Implementar detalle de viajes con ganancias
    - Incluir lista de viajes con tarifa individual
    - Mostrar comisión de plataforma
    - Mostrar ganancia neta por viaje
    - _Requisitos: 12.4_

- [ ] 20. Implementar dashboard administrativo (backend)
  - [x] 20.1 Implementar estadísticas generales
    - Crear GET /api/admin/statistics
    - Calcular total de viajes por rango de fechas
    - Calcular ingresos totales
    - Contar usuarios activos (pasajeros y conductores)
    - Calcular rating promedio de conductores
    - Calcular tasa de completación de viajes
    - _Requisitos: 16.1, 16.2, 16.3, 16.4, 16.5, 16.7_

  - [ ]\* 20.2 Property test: Ride Completion Rate Calculation
    - **Propiedad 31: Ride Completion Rate Calculation**
    - **Valida: Requisito 16.7**

  - [x] 20.3 Implementar monitoreo de viajes activos
    - Crear GET /api/admin/rides/active
    - Incluir ubicación de conductores
    - Incluir estado de cada viaje
    - Actualizar en tiempo real con WebSocket
    - _Requisitos: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 20.4 Implementar exportación de reportes
    - Crear POST /api/admin/reports/export
    - Generar CSV con datos de viajes
    - Incluir filtros por fecha
    - Enviar archivo o URL de descarga
    - _Requisitos: 16.6_

  - [ ]\* 20.5 Property test: CSV Export Generation
    - **Propiedad 30: CSV Export Generation**
    - **Valida: Requisito 16.6**

- [ ] 21. Checkpoint - Verificar funcionalidad backend completa
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ] 22. Implementar seguridad y rate limiting
  - [x] 22.1 Implementar rate limiting
    - Instalar express-rate-limit
    - Configurar límites por IP para endpoints públicos
    - Configurar límites por usuario para endpoints autenticados
    - Límite estricto para /api/auth/login (prevenir brute force)
    - _Requisitos: 24.6_

  - [ ]\* 22.2 Property test: Rate Limiting Protection
    - **Propiedad 46: Rate Limiting Protection**
    - **Valida: Requisito 24.6**

  - [x] 22.3 Implementar validación y sanitización de inputs
    - Usar Zod para validación de schemas
    - Sanitizar inputs para prevenir XSS
    - Usar prepared statements para prevenir SQL injection
    - _Requisitos: 24.1, 24.2_

  - [x] 22.4 Implementar HTTPS y seguridad de headers
    - Configurar helmet.js para headers de seguridad
    - Configurar CORS apropiadamente
    - Forzar HTTPS en producción
    - _Requisitos: 24.2_

- [ ] 23. Implementar funcionalidad de pasajeros en la app móvil
  - [x] 23.1 Configurar navegación y estructura base
    - Configurar React Navigation con stack y tabs
    - Crear estructura de carpetas (app/(auth), app/(passenger), app/(driver), components/, hooks/, services/)
    - Configurar Zustand para estado global con manejo de roles
    - Crear servicio API con Axios
    - Implementar selector de rol en pantalla de login/registro
    - Configurar navegación condicional basada en rol del usuario
    - _Requisitos: Todos_

  - [x] 23.2 Implementar pantallas de autenticación compartidas
    - Crear LoginScreen siguiendo diseño UrbanTaxi:
      - Logo UrbanTaxi en la parte superior
      - Tagline "¿Listo para tu siguiente destino?"
      - Mensaje "Bienvenido de vuelta"
      - Selector de rol: "¿Eres pasajero o conductor?"
      - Input de email/teléfono con borde verde (#00B300), esquinas redondeadas
      - Input de contraseña con borde verde, icono de ojo para mostrar/ocultar
      - Checkbox "Recuérdame" con acento verde
      - Link "¿Olvidaste tu Contraseña?" en verde
      - Botón primario "Empezar a viajar" (pasajero) o "Empezar a trabajar" (conductor) en verde (#00B300), redondeado
      - Link "¿Aún no tienes una cuenta? Regístrate aquí." con acento verde
      - Botones de Google y Apple con fondo blanco
    - Crear RegisterScreen con selector de rol y el mismo estilo visual
    - Crear ForgotPasswordScreen con estilo consistente
    - Integrar con endpoints de autenticación
    - Almacenar tokens y rol de usuario en SecureStore
    - Redirigir a navegación apropiada según rol seleccionado
    - _Requisitos: 1, 2, 29.1, 29.4, 29.6, 29.7, 29.8, 29.9, 29.11, 29.12_

  - [x] 23.3 Implementar pantalla principal con mapa
    - Integrar react-native-maps
    - Mostrar ubicación actual del usuario
    - Implementar búsqueda de dirección de destino
    - Mostrar marcador de pickup y destino
    - Dibujar ruta estimada en mapa
    - _Requisitos: 5.1, 5.2_

  - [x] 23.4 Implementar selector de tipo de vehículo
    - Crear componente VehicleTypeSelector con estilo UrbanTaxi
    - Mostrar opciones: taxi, moto-taxi
    - Usar colores de marca (verde para seleccionado, gris para no seleccionado)
    - Actualizar tarifa estimada al cambiar tipo
    - _Requisitos: 5.3, 29.1_

  - [x] 23.5 Implementar solicitud de viaje
    - Calcular y mostrar tarifa estimada
    - Mostrar desglose de tarifa
    - Botón de confirmación "Solicitar viaje" en verde (#00B300), redondeado
    - Llamar a POST /api/rides/request
    - Mostrar estado "Buscando conductor..." con indicador verde
    - _Requisitos: 5.4, 5.5, 5.7, 9.6, 29.9_

  - [x] 23.6 Implementar seguimiento de viaje en tiempo real
    - Conectar a WebSocket al aceptar viaje
    - Mostrar información del conductor
    - Actualizar ubicación del conductor en mapa
    - Mostrar ETA dinámico
    - Mostrar estado del viaje (aceptado, llegó, en progreso)
    - _Requisitos: 6.4, 7.2, 7.3, 7.4, 8.2, 8.3, 8.4_

  - [x] 23.7 Implementar cancelación de viaje
    - Botón de cancelar viaje en naranja (#FF9500), redondeado
    - Mostrar advertencia de tarifa de cancelación si aplica
    - Confirmar cancelación con modal
    - Llamar a POST /api/rides/:id/cancel
    - _Requisitos: 21.1, 21.3, 21.5, 29.9_

  - [x] 23.8 Implementar pantalla de pago
    - Mostrar tarifa final al completar viaje
    - Mostrar método de pago seleccionado
    - Procesar pago automáticamente (no efectivo)
    - Mostrar confirmación de pago
    - _Requisitos: 10.3, 10.5_

  - [x] 23.9 Implementar valoración de conductor
    - Mostrar modal de valoración al completar viaje
    - Componente de estrellas (1-5)
    - Campo de comentario opcional
    - Enviar a POST /api/ratings/driver
    - _Requisitos: 11.1, 11.2, 11.3_

  - [x] 23.10 Implementar gestión de métodos de pago
    - Pantalla PaymentMethodsScreen
    - Listar métodos de pago registrados
    - Agregar nuevo método (efectivo, tarjeta, billetera)
    - Marcar método por defecto
    - Eliminar método de pago
    - _Requisitos: 10.1, 10.2_

  - [x] 23.11 Implementar historial de viajes
    - Pantalla RideHistoryScreen
    - Listar viajes completados
    - Mostrar detalles: fecha, origen, destino, tarifa, conductor
    - Filtrar por rango de fechas
    - _Requisitos: 18.1, 18.2, 18.3_

  - [x] 23.12 Implementar perfil de usuario
    - Pantalla ProfileScreen
    - Mostrar y editar información personal
    - Cambiar idioma (español/inglés)
    - Configurar preferencias de notificaciones
    - Cerrar sesión
    - Eliminar cuenta
    - _Requisitos: 22.1, 22.2, 22.3, 22.4, 24.5_

  - [x] 23.13 Implementar notificaciones push
    - Configurar expo-notifications
    - Registrar token de dispositivo
    - Manejar notificaciones en foreground
    - Manejar notificaciones en background
    - Navegar a pantalla correcta al tocar notificación
    - _Requisitos: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [x] 24. Checkpoint - Verificar funcionalidad de pasajeros
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [x] 25. Implementar funcionalidad de conductores en la app móvil
  - [x] 25.1 Implementar registro de conductor con documentos
    - Formulario de registro con datos de vehículo
    - Pantalla de carga de documentos
    - Usar expo-image-picker para fotos
    - Subir documentos a el backend con multer.
    - Mostrar estado de verificación
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 25.2 Implementar actualización de documentos
    - Pantalla DocumentsScreen
    - Ver documentos actuales
    - Subir versiones actualizadas
    - Mostrar estado de re-verificación
    - _Requisitos: 23.1, 23.2, 23.3_

  - [x] 25.3 Implementar pantalla principal de conductor con mapa
    - Mostrar mapa con ubicación actual (solo en modo conductor)
    - Toggle de disponibilidad (online/offline)
    - Actualizar ubicación cada 5 segundos cuando esté disponible
    - Enviar ubicación a WebSocket
    - _Requisitos: 19.1, 19.2, 19.4, 7.1_

  - [x] 25.4 Implementar recepción de solicitudes de viaje
    - Escuchar notificaciones push de nuevas solicitudes
    - Mostrar card con detalles del viaje
    - Mostrar origen, destino, tarifa estimada, distancia
    - Botones de aceptar y rechazar
    - Timeout de 30 segundos para responder
    - _Requisitos: 6.1, 6.2, 6.6_

  - [x] 25.5 Implementar aceptación y gestión de viaje activo
    - Aceptar viaje y cambiar a pantalla de viaje activo (modo conductor)
    - Mostrar información del pasajero
    - Mostrar ruta a punto de recogida
    - Botón "He llegado" al llegar a pickup
    - Botón "Iniciar viaje" cuando pasajero suba
    - Mostrar ruta a destino durante viaje
    - Botón "Completar viaje" al llegar a destino
    - _Requisitos: 6.3, 8.3, 8.4, 8.5_

  - [x] 25.6 Implementar navegación integrada
    - Integrar con Google Maps / Apple Maps
    - Botón para abrir navegación externa
    - Mostrar ruta en mapa interno
    - Actualizar ruta con tráfico en tiempo real
    - _Requisitos: 20.1, 20.2, 20.3, 20.4, 20.5_

  - [x] 25.7 Implementar valoración de pasajero
    - Mostrar modal de valoración al completar viaje (modo conductor)
    - Componente de estrellas (1-5)
    - Enviar a POST /api/ratings/passenger
    - _Requisitos: 11.4, 11.5_

  - [x] 25.8 Implementar panel de ganancias
    - Pantalla EarningsScreen
    - Mostrar ganancias del día, semana, mes
    - Mostrar número de viajes completados
    - Listar viajes con ganancia individual
    - Mostrar gráfico de ganancias
    - _Requisitos: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 25.9 Implementar historial de viajes de conductor
    - Pantalla RideHistoryScreen (modo conductor)
    - Listar viajes completados
    - Mostrar detalles: fecha, origen, destino, ganancia
    - _Requisitos: 18.4, 18.5_

  - [x] 25.10 Implementar perfil de conductor
    - Pantalla DriverProfileScreen
    - Mostrar información personal y del vehículo
    - Mostrar rating promedio
    - Ver documentos de verificación
    - Configuración de idioma y notificaciones
    - Cerrar sesión
    - _Requisitos: 22.1, 22.2, 22.3, 22.4_

  - [x] 25.11 Implementar notificaciones push para conductores
    - Configurar expo-notifications (compartido con pasajeros)
    - Registrar token de dispositivo
    - Recibir notificaciones de solicitudes de viaje (modo conductor)
    - Recibir notificación de verificación aprobada/rechazada
    - _Requisitos: 17.1, 17.4, 17.5_

- [x] 26. Checkpoint - Verificar funcionalidad de conductores
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [x] 27. Implementar dashboard administrativo (Admin Dashboard - Express + EJS)
  - [x] 27.1 Configurar proyecto web con Express y express-layout-ejs
    - Instalar express-layout-ejs en backend
    - Crear carpeta views/ con estructura de layouts
    - Crear layout principal (layout.ejs) con navbar y sidebar
    - Configurar rutas GET para servir vistas
    - Configurar middleware de autenticación para admin
    - Crear estructura de carpetas: views/admin/, views/layouts/, public/css/, public/js/
    - _Requisitos: Todos_

  - [x] 27.2 Implementar autenticación de administrador
    - Crear vista login.ejs con formulario de admin
    - Crear endpoint POST /admin/login para validar credenciales
    - Generar JWT y almacenar en cookie segura (httpOnly)
    - Crear middleware adminAuth para proteger rutas
    - Redirigir a /admin/dashboard si está autenticado
    - Implementar logout en GET /admin/logout
    - _Requisitos: 2_

  - [x] 27.3 Implementar dashboard principal
    - Crear vista dashboard.ejs con layout
    - Mostrar tarjetas de estadísticas (viajes, ingresos, usuarios)
    - Integrar Chart.js para gráficos de ingresos
    - Integrar Chart.js para gráfico de tasa de completación
    - Mostrar feed de actividad reciente en tabla
    - Crear endpoint GET /api/admin/statistics para datos
    - _Requisitos: 16.1, 16.2, 16.3, 16.4, 16.5, 16.7_

  - [x] 27.4 Implementar gestión de usuarios
    - Crear vista users-list.ejs (pasajeros) con tabla paginada
    - Crear vista drivers-list.ejs con tabla paginada
    - Implementar búsqueda por nombre, email, teléfono
    - Crear modal para ver detalles de usuario
    - Agregar botones de suspender/reactivar cuenta
    - Crear endpoints GET /api/admin/users y GET /api/admin/drivers
    - Crear endpoints PUT /api/admin/users/:id/suspend y /reactivate
    - _Requisitos: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [x] 27.5 Implementar verificación de conductores
    - Crear vista pending-verifications.ejs con lista de conductores
    - Crear modal para ver documentos subidos
    - Integrar visor de imágenes (Lightbox o similar)
    - Agregar botones de aprobar/rechazar
    - Agregar campo de razón de rechazo
    - Crear endpoints GET /api/admin/drivers/pending-verification
    - Crear endpoints PUT /api/admin/drivers/:id/verify y /reject
    - _Requisitos: 4.1, 4.2, 4.3, 4.4_

  - [x] 27.6 Implementar monitoreo de viajes en tiempo real
    - Crear vista live-map.ejs con mapa interactivo
    - Integrar Leaflet
    - Conectar a WebSocket para actualizaciones en tiempo real
    - Mostrar marcadores de viajes activos con ubicación de conductores
    - Crear panel lateral con detalles de viaje al hacer clic
    - Agregar filtros por estado de viaje (pending, accepted, in_progress)
    - Crear endpoint GET /api/admin/rides/active para datos iniciales
    - _Requisitos: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 27.7 Implementar configuración de tarifas
    - Crear vista fare-config.ejs con formularios
    - Crear formularios para cada tipo de vehículo (taxi, moto-taxi)
    - Campos: tarifa base, tarifa por km, tarifa por minuto
    - Campo de porcentaje de comisión
    - Campo de multiplicador de surge pricing
    - Campo de tarifa de cancelación
    - Crear endpoint GET /api/admin/fare-config para obtener configuración
    - Crear endpoint PUT /api/admin/fare-config para guardar
    - _Requisitos: 15.1, 15.2, 15.3, 15.4, 15.5, 21.6_

  - [x] 27.8 Implementar reportes y exportación
    - Crear vista reports.ejs con selector de rango de fechas
    - Mostrar métricas del período (viajes, ingresos, usuarios)
    - Agregar botón de exportar a CSV
    - Crear endpoint POST /api/admin/reports/export para generar CSV
    - Implementar descarga de archivo CSV
    - Mostrar tabla de datos antes de exportar
    - _Requisitos: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_

- [ ] 28. Implementar soporte multiidioma y diseño visual
  - [x] 28.1 Crear sistema de diseño UrbanTaxi
    - Crear constants/theme.ts con paleta de colores completa
    - Definir colores: primary (#00B300), secondary (#32CD32), light (#90EE90), orange (#FF9500), lightOrange (#E6C896), darkGray (#505050), lightGray (#A9A9A9)
    - Crear componentes reutilizables: Button (primary/cancel), Input (con bordes verdes), Card
    - Definir estilos de tipografía (H1, H2, body, placeholder)
    - Crear componente Logo de UrbanTaxi
    - _Requisitos: 29.1, 29.2, 29.3, 29.4, 29.5, 29.8, 29.9, 29.10_

  - [ ]\* 28.2 Property test: Brand Color Consistency
    - **Propiedad 58: Brand Color Consistency**
    - **Valida: Requisitos 29.1, 29.2, 29.3**

  - [x] 28.3 Configurar i18n en aplicaciones
    - Instalar react-i18next o expo-localization
    - Crear archivos de traducción (es.json, en.json)
    - Traducir todas las cadenas de texto incluyendo: "Bienvenido de vuelta", "¿Listo para tu siguiente destino?", "Empezar a viajar", "¿Olvidaste tu Contraseña?", "Regístrate aquí"
    - Detectar idioma del dispositivo
    - _Requisitos: 22.1, 22.2, 22.3, 22.4, 22.5, 29.11, 29.12_

  - [ ]\* 28.4 Property test: Device Language Detection
    - **Propiedad 40: Device Language Detection**
    - **Valida: Requisito 22.5**

  - [ ]\* 28.5 Property test: Login Screen Design Compliance
    - **Propiedad 59: Login Screen Design Compliance**
    - **Valida: Requisitos 29.6, 29.7, 29.8, 29.9, 29.11, 29.12**

- [ ] 29. Checkpoint - Verificar dashboard y multiidioma
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ] 30. Integrar servicios externos
  - [x] 30.1 Integrar OpenStreetMap + Nominatim + OSRM
    - Configurar servicio de OpenStreetMap para mapas gratuitos
    - Integrar Nominatim API para geocodificación (dirección ↔ coordenadas)
    - Integrar OSRM API para cálculo de rutas y distancias
    - Configurar URLs de servicios en variables de entorno
    - Implementar fallbacks y manejo de errores
    - Optimizar para Venezuela (countrycodes: 've')
    - _Requisitos: 5.2, 5.4, 7.5, 9.1, 20.5_

  - [x] 30.2 Integrar APIs de bancos venezolanos para pagos
    - Configurar integración con Banesco API para Pago Móvil
    - Integrar Banco de Venezuela API para transferencias
    - Implementar Mercantil API para pagos digitales
    - Configurar Provincial API para transferencias bancarias
    - Implementar tokenización y seguridad PCI-DSS
    - Manejar webhooks de confirmación de pagos
    - Implementar sistema de conciliación bancaria
    - _Requisitos: 10.2, 10.5, 10.6_

  - [x] 30.3 Integrar servicio de email
    - Configurar nodemailer
    - Crear plantillas de email (recibos, recuperación de contraseña)
    - Implementar envío de emails transaccionales
    - _Requisitos: 2.6, 10.7_

  - [x] 30.4 Integrar almacenamiento de archivos
    - Configurar cuenta de Cloudinary
    - Implementar upload de imágenes
    - Generar URLs firmadas para acceso seguro
    - Implementar eliminación de archivos
    - _Requisitos: 3.3, 3.4, 23.2_

- [ ] 31. Implementar características opcionales
  - [ ] 31.1 Implementar viajes programados (opcional)
    - Agregar campo scheduled_pickup_time en solicitud
    - Crear estado "scheduled" para viajes
    - Implementar job scheduler (node-cron o Bull)
    - Notificar conductores 15 minutos antes
    - Enviar recordatorio a pasajero 30 minutos antes
    - Permitir cancelación hasta 1 hora antes sin cargo
    - _Requisitos: 25.1, 25.2, 25.3, 25.4, 25.5_

  - [ ]\* 31.2 Property test: Scheduled Ride Creation
    - **Propiedad 47: Scheduled Ride Creation**
    - **Valida: Requisitos 25.2, 25.3**

  - [ ]\* 31.3 Property test: Scheduled Ride Cancellation Window
    - **Propiedad 48: Scheduled Ride Cancellation Window**
    - **Valida: Requisito 25.4**

  - [ ] 31.4 Implementar programa de fidelización (opcional)
    - Agregar campo loyalty_points en passenger_profiles
    - Calcular y otorgar puntos al completar viaje
    - Crear endpoint para canjear puntos por descuentos
    - Mostrar balance de puntos en app de pasajero
    - Configurar tasa de conversión en admin dashboard
    - _Requisitos: 26.1, 26.2, 26.3, 26.4, 26.5_

  - [ ]\* 31.5 Property test: Loyalty Points Award
    - **Propiedad 49: Loyalty Points Award**
    - **Valida: Requisitos 26.1, 26.2**

  - [ ]\* 31.6 Property test: Points Redemption
    - **Propiedad 50: Points Redemption**
    - **Valida: Requisito 26.4**

  - [ ]\* 31.7 Property test: Loyalty Points Configuration
    - **Propiedad 51: Loyalty Points Configuration**
    - **Valida: Requisito 26.5**

  - [ ] 31.8 Implementar viajes compartidos (opcional)
    - Agregar opción de viaje compartido en solicitud
    - Implementar algoritmo de matching de rutas similares
    - Calcular descuento para viajes compartidos
    - Limitar a máximo 3 pasajeros
    - Notificar a pasajeros sobre viaje compartido
    - _Requisitos: 27.1, 27.2, 27.3, 27.4, 27.5_

  - [ ]\* 31.9 Property test: Shared Ride Matching
    - **Propiedad 52: Shared Ride Matching**
    - **Valida: Requisito 27.2**

  - [ ]\* 31.10 Property test: Shared Ride Discount
    - **Propiedad 53: Shared Ride Discount**
    - **Valida: Requisito 27.3**

  - [ ]\* 31.11 Property test: Shared Ride Passenger Limit
    - **Propiedad 54: Shared Ride Passenger Limit**
    - **Valida: Requisito 27.5**

  - [ ] 31.12 Implementar gamificación para conductores (opcional)
    - Crear tabla de badges y achievements
    - Definir milestones (100 viajes, 500 viajes, etc.)
    - Otorgar badges al alcanzar milestones
    - Implementar seguimiento de metas diarias/semanales
    - Otorgar puntos bonus por alcanzar metas
    - Mostrar badges y progreso en app de conductor
    - _Requisitos: 28.1, 28.2, 28.3, 28.4, 28.5_

  - [ ]\* 31.13 Property test: Gamification Badge Awards
    - **Propiedad 55: Gamification Badge Awards**
    - **Valida: Requisito 28.1**

  - [ ]\* 31.14 Property test: Gamification Goal Tracking
    - **Propiedad 56: Gamification Goal Tracking**
    - **Valida: Requisito 28.3**

  - [ ]\* 31.15 Property test: Gamification Bonus Awards
    - **Propiedad 57: Gamification Bonus Awards**
    - **Valida: Requisito 28.5**

- [ ] 32. Checkpoint - Verificar características opcionales
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ]\* 33. Testing integral y optimización
  - [ ]\* 33.1 Ejecutar suite completa de property tests
    - Ejecutar todos los property tests con 100+ iteraciones
    - Verificar que todas las propiedades se cumplan
    - Documentar cualquier fallo encontrado
    - Ajustar implementación si es necesario

  - [ ]\* 33.2 Ejecutar suite completa de unit tests
    - Verificar cobertura de código ≥ 80%
    - Ejecutar tests de integración
    - Verificar todos los endpoints de API
    - Validar manejo de errores

  - [ ]\* 33.3 Realizar pruebas de carga
    - Simular 1000 solicitudes de viaje concurrentes
    - Simular 10,000 actualizaciones de ubicación por segundo
    - Medir tiempos de respuesta (p50, p95, p99)
    - Identificar cuellos de botella

  - [ ]\* 33.4 Optimizar consultas de base de datos
    - Analizar queries lentas con EXPLAIN
    - Agregar índices faltantes
    - Optimizar queries N+1
    - Configurar connection pooling

  - [ ]\* 33.5 Implementar caché estratégico
    - Cachear configuración de tarifas en Redis
    - Cachear ubicaciones de conductores (TTL 30s)
    - Cachear datos de usuario frecuentemente accedidos
    - Implementar invalidación de caché

- [ ] 34. Configurar monitoreo y logging
  - [x] 34.1 Configurar logging estructurado
    - Instalar Winston o Pino
    - Configurar niveles de log (error, warn, info, debug)
    - Agregar context a logs (userId, rideId, requestId)
    - Configurar rotación de archivos de log
    - _Requisitos: Todos_

  - [x] 34.2 Configurar monitoreo de errores
    - Integrar Sentry para tracking de errores
    - Configurar source maps para stack traces
    - Configurar alertas para errores críticos
    - Agregar breadcrumbs para contexto
    - _Requisitos: Todos_

  - [x] 34.3 Configurar métricas y observabilidad
    - Implementar health check endpoint
    - Exponer métricas de Prometheus
    - Configurar dashboards en Grafana
    - Monitorear: latencia, error rate, throughput
    - _Requisitos: Todos_

  - [x] 34.4 Configurar alertas
    - Alertas por error rate > 5%
    - Alertas por latencia > 2 segundos
    - Alertas por CPU/memoria alta
    - Alertas por fallos de pago
    - _Requisitos: Todos_

- [ ]\* 35. Preparar para despliegue
  - [ ]\* 35.1 Configurar Docker para backend
    - Crear Dockerfile optimizado
    - Crear docker-compose.yml para desarrollo
    - Configurar multi-stage build
    - Optimizar tamaño de imagen
    - _Requisitos: Todos_

  - [ ]\* 35.2 Configurar variables de entorno
    - Crear .env.example con todas las variables
    - Documentar cada variable de entorno
    - Configurar diferentes entornos (dev, staging, prod)
    - Usar secrets manager para producción
    - _Requisitos: Todos_

  - [ ]\* 35.3 Configurar CI/CD con GitHub Actions
    - Crear workflow para tests automáticos
    - Crear workflow para build de backend
    - Crear workflow para build de apps móviles con EAS
    - Configurar despliegue automático a staging
    - Configurar despliegue manual a producción
    - _Requisitos: Todos_

  - [ ]\* 35.4 Configurar base de datos de producción
    - Provisionar PostgreSQL en RDS o similar
    - Configurar backups automáticos
    - Configurar réplicas de lectura
    - Habilitar point-in-time recovery
    - _Requisitos: Todos_

  - [ ]\* 35.5 Configurar Redis de producción
    - Provisionar Redis en ElastiCache o similar
    - Configurar persistencia
    - Configurar clustering si es necesario
    - _Requisitos: Todos_

- [ ]\* 36. Checkpoint - Verificar preparación para despliegue
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ]\* 37. Desplegar backend
  - [ ]\* 37.1 Desplegar a staging
    - Configurar servidor en AWS EC2/ECS o DigitalOcean
    - Configurar load balancer
    - Desplegar contenedor Docker
    - Ejecutar migraciones de base de datos
    - Verificar health checks
    - _Requisitos: Todos_

  - [ ]\* 37.2 Configurar dominio y SSL
    - Configurar dominio personalizado
    - Configurar certificado SSL con Let's Encrypt
    - Configurar CloudFlare para CDN y DDoS protection
    - _Requisitos: 24.2_

  - [ ]\* 37.3 Ejecutar pruebas en staging
    - Ejecutar suite de tests E2E
    - Verificar integración con servicios externos
    - Probar flujos críticos manualmente
    - Verificar WebSockets funcionan correctamente
    - _Requisitos: Todos_

  - [ ]\* 37.4 Desplegar a producción
    - Configurar auto-scaling
    - Desplegar con estrategia blue-green
    - Ejecutar smoke tests
    - Monitorear métricas post-despliegue
    - _Requisitos: Todos_

- [ ]\* 38. Desplegar aplicación móvil unificada
  - [ ]\* 38.1 Configurar EAS Build
    - Instalar EAS CLI
    - Configurar eas.json con perfiles de build
    - Configurar credenciales de firma para Android e iOS
    - Configurar app.json con identificadores únicos
    - _Requisitos: Todos_

  - [ ]\* 38.2 Build y despliegue Android (App unificada)
    - Ejecutar `eas build --platform android --profile production`
    - Generar AAB firmado
    - Crear listing en Google Play Console
    - Configurar screenshots mostrando ambos modos (pasajero y conductor)
    - Subir AAB a Google Play
    - Configurar release gradual (10% → 50% → 100%)
    - _Requisitos: Todos_

  - [ ]\* 38.3 Build y despliegue iOS (App unificada)
    - Ejecutar `eas build --platform ios --profile production`
    - Generar IPA firmado
    - Subir a App Store Connect con EAS Submit
    - Configurar TestFlight para beta testing
    - Crear listing en App Store
    - Configurar screenshots mostrando ambos modos (pasajero y conductor)
    - Enviar para revisión de Apple
    - _Requisitos: Todos_

- [ ]\* 39. Desplegar dashboard web administrativo
  - [ ]\* 39.1 Preparar vistas EJS para producción
    - Minificar CSS y JavaScript
    - Optimizar imágenes
    - Configurar caché de assets estáticos
    - Crear archivo .env.production con variables
    - _Requisitos: Todos_

  - [ ]\* 39.2 Desplegar a servidor de producción
    - Desplegar backend Express con vistas EJS
    - Configurar dominio personalizado (ej: admin.urbantaxi.com)
    - Configurar certificado SSL con Let's Encrypt
    - Configurar nginx como reverse proxy
    - Habilitar compresión gzip
    - _Requisitos: Todos_

  - [ ]\* 39.3 Configurar seguridad del dashboard
    - Implementar CSRF protection con csurf
    - Configurar rate limiting para login
    - Implementar 2FA para administradores (opcional)
    - Configurar session timeout
    - Implementar audit logging de acciones de admin
    - _Requisitos: 24.2, 24.6_

- [ ]\* 40. Post-despliegue y monitoreo
  - [ ]\* 40.1 Configurar analytics
    - Integrar Google Analytics o Mixpanel
    - Trackear eventos clave (registro, solicitud de viaje, pago)
    - Configurar funnels de conversión
    - _Requisitos: Todos_

  - [ ]\* 40.2 Monitorear métricas de negocio
    - Viajes por hora/día
    - Tasa de conversión de solicitudes
    - Ingresos diarios
    - Usuarios activos
    - Tiempo promedio de espera
    - _Requisitos: 16.1, 16.2, 16.3, 16.4, 16.7_

  - [ ]\* 40.3 Configurar sistema de feedback
    - Implementar formulario de feedback en apps
    - Monitorear ratings y reviews en stores
    - Configurar sistema de tickets de soporte
    - _Requisitos: 11_

  - [ ]\* 40.4 Documentar APIs
    - Generar documentación con Swagger/OpenAPI
    - Documentar todos los endpoints
    - Incluir ejemplos de requests/responses
    - Publicar documentación para integraciones futuras
    - _Requisitos: Todos_

- [ ]\* 41. Checkpoint final - Verificar despliegue completo
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requisitos específicos que implementa para trazabilidad
- Los checkpoints aseguran validación incremental del progreso
- Los property tests validan propiedades universales de correctness
- Los unit tests validan casos específicos y condiciones de error
- La implementación sigue un orden lógico: backend core → app móvil unificada → dashboard → características opcionales → despliegue
- Se priorizan características core antes de opcionales (viajes programados, fidelización, compartidos, gamificación)
- **Arquitectura de app móvil**: Una sola aplicación con navegación condicional basada en el rol del usuario (pasajero o conductor), resultando en 2 builds totales (1 Android + 1 iOS) en lugar de 4 apps separadas

## Próximos Pasos

Una vez completado este plan de implementación:

1. Abrir el archivo `tasks.md`
2. Hacer clic en "Start task" junto a cualquier tarea para comenzar la implementación
3. El sistema guiará la implementación paso a paso
4. Los tests se ejecutarán automáticamente para validar cada componente
5. Los checkpoints permitirán pausar y revisar el progreso con el usuario
