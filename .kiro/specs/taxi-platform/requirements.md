# Requirements Document

## Introduction

Esta plataforma de taxis y moto-taxis conecta pasajeros con conductores a través de aplicaciones móviles, permitiendo solicitar viajes, realizar seguimiento en tiempo real, procesar pagos y gestionar valoraciones. El sistema incluye una aplicación para pasajeros, una aplicación para conductores y un dashboard administrativo para la gestión y monitoreo de la plataforma.

## Glossary

- **Passenger_App**: Aplicación móvil para usuarios que solicitan viajes
- **Driver_App**: Aplicación móvil para conductores que ofrecen servicios de transporte
- **Admin_Dashboard**: Panel web para administradores de la plataforma
- **Platform**: Sistema completo que incluye todas las aplicaciones y servicios backend
- **Ride_Request**: Solicitud de viaje creada por un pasajero
- **Active_Ride**: Viaje que ha sido aceptado y está en progreso
- **Driver_Profile**: Perfil de conductor con documentos verificados
- **Payment_Method**: Método de pago registrado (efectivo, tarjeta, billetera digital)
- **Rating**: Valoración de 1 a 5 estrellas
- **Fare**: Tarifa calculada para un viaje
- **Geolocation**: Coordenadas de latitud y longitud
- **Push_Notification**: Notificación enviada a dispositivos móviles
- **Verification_Document**: Documento requerido para registro de conductor (licencia, SOAT, etc.)

## Requirements

### Requirement 1: Registro de Pasajeros

**User Story:** Como pasajero, quiero registrarme en la plataforma, para poder solicitar viajes.

#### Acceptance Criteria

1. THE Passenger_App SHALL provide a registration form with fields for name, email, phone number, and password
2. WHEN a passenger submits valid registration data, THE Platform SHALL create a new passenger account
3. WHEN a passenger submits registration data with an existing email or phone, THE Platform SHALL return an error message indicating the conflict
4. THE Platform SHALL validate that the email format is correct before creating an account
5. THE Platform SHALL validate that the phone number format is correct before creating an account
6. THE Platform SHALL require passwords to be at least 8 characters long

### Requirement 2: Autenticación de Usuarios

**User Story:** Como usuario del sistema, quiero iniciar sesión de forma segura, para acceder a mi cuenta.

#### Acceptance Criteria

1. THE Passenger_App SHALL provide a login form with email and password fields
2. THE Driver_App SHALL provide a login form with email and password fields
3. WHEN a user submits valid credentials, THE Platform SHALL authenticate the user and return an access token
4. WHEN a user submits invalid credentials, THE Platform SHALL return an authentication error
5. THE Platform SHALL expire access tokens after 24 hours of inactivity
6. THE Platform SHALL support password recovery via email

### Requirement 3: Registro de Conductores

**User Story:** Como conductor, quiero registrarme en la plataforma, para poder ofrecer servicios de transporte.

#### Acceptance Criteria

1. THE Driver_App SHALL provide a registration form with fields for name, email, phone number, password, vehicle type, license plate, and vehicle model
2. WHEN a driver submits valid registration data, THE Platform SHALL create a pending driver account
3. THE Driver_App SHALL allow drivers to upload photos of required verification documents
4. THE Platform SHALL require the following verification documents: driver's license, vehicle registration, insurance certificate, and vehicle photos
5. WHEN all documents are uploaded, THE Platform SHALL mark the driver profile as pending verification
6. THE Platform SHALL prevent drivers from accepting rides until their profile is verified

### Requirement 4: Verificación de Conductores

**User Story:** Como administrador, quiero verificar los documentos de los conductores, para garantizar la seguridad de la plataforma.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a list of drivers pending verification
2. THE Admin_Dashboard SHALL allow administrators to view uploaded verification documents
3. WHEN an administrator approves a driver, THE Platform SHALL mark the driver profile as verified and send a notification
4. WHEN an administrator rejects a driver, THE Platform SHALL mark the driver profile as rejected and send a notification with the rejection reason
5. THE Platform SHALL allow only verified drivers to receive ride requests

### Requirement 5: Solicitud de Viajes

**User Story:** Como pasajero, quiero solicitar un viaje, para trasladarme de un lugar a otro.

#### Acceptance Criteria

1. THE Passenger_App SHALL display a map showing the passenger's current location
2. THE Passenger_App SHALL allow passengers to enter a destination address
3. THE Passenger_App SHALL allow passengers to select vehicle type (taxi or moto-taxi)
4. WHEN a passenger confirms a ride request, THE Platform SHALL calculate the estimated fare
5. WHEN a passenger confirms a ride request, THE Platform SHALL create a ride request and notify nearby available drivers
6. THE Platform SHALL send ride requests only to drivers within 5 kilometers of the pickup location
7. THE Passenger_App SHALL display the estimated fare before the passenger confirms the request

### Requirement 6: Aceptación de Viajes por Conductores

**User Story:** Como conductor, quiero recibir y aceptar solicitudes de viaje, para generar ingresos.

#### Acceptance Criteria

1. WHEN a ride request is created, THE Platform SHALL send push notifications to available drivers within range
2. THE Driver_App SHALL display ride request details including pickup location, destination, and estimated fare
3. WHEN a driver accepts a ride request, THE Platform SHALL assign the ride to that driver
4. WHEN a driver accepts a ride request, THE Platform SHALL notify the passenger with driver details
5. WHEN a ride is assigned to a driver, THE Platform SHALL cancel pending notifications to other drivers
6. THE Driver_App SHALL allow drivers to reject ride requests
7. IF no driver accepts a ride request within 2 minutes, THEN THE Platform SHALL cancel the request and notify the passenger

### Requirement 7: Seguimiento de Viajes en Tiempo Real

**User Story:** Como pasajero, quiero ver la ubicación del conductor en tiempo real, para saber cuándo llegará.

#### Acceptance Criteria

1. WHILE a ride is active, THE Driver_App SHALL send location updates to the Platform every 5 seconds
2. WHILE a ride is active, THE Passenger_App SHALL display the driver's current location on a map
3. WHILE a driver is en route to pickup, THE Passenger_App SHALL display the estimated arrival time
4. WHILE a ride is in progress, THE Passenger_App SHALL display the route to the destination
5. THE Platform SHALL calculate estimated arrival time based on current traffic conditions

### Requirement 8: Estados del Viaje

**User Story:** Como usuario del sistema, quiero que el viaje tenga estados claros, para entender el progreso del servicio.

#### Acceptance Criteria

1. WHEN a ride request is created, THE Platform SHALL set the ride status to "pending"
2. WHEN a driver accepts a ride, THE Platform SHALL set the ride status to "accepted"
3. WHEN a driver arrives at pickup location, THE Driver_App SHALL allow the driver to mark arrival and THE Platform SHALL set the ride status to "arrived"
4. WHEN a passenger enters the vehicle, THE Driver_App SHALL allow the driver to start the trip and THE Platform SHALL set the ride status to "in_progress"
5. WHEN a driver reaches the destination, THE Driver_App SHALL allow the driver to complete the trip and THE Platform SHALL set the ride status to "completed"
6. THE Platform SHALL allow drivers or passengers to cancel rides before they start
7. WHEN a ride is cancelled, THE Platform SHALL set the ride status to "cancelled"

### Requirement 9: Cálculo de Tarifas

**User Story:** Como pasajero, quiero conocer el costo del viaje, para decidir si lo acepto.

#### Acceptance Criteria

1. THE Platform SHALL calculate fares based on distance, estimated time, and vehicle type
2. THE Platform SHALL apply a base fare configured by administrators
3. THE Platform SHALL apply a per-kilometer rate configured by administrators
4. THE Platform SHALL apply a per-minute rate configured by administrators
5. WHERE surge pricing is enabled, THE Platform SHALL apply a multiplier during high-demand periods
6. THE Platform SHALL display the fare breakdown to passengers before ride confirmation
7. WHEN a ride is completed, THE Platform SHALL calculate the final fare based on actual distance and time

### Requirement 10: Procesamiento de Pagos

**User Story:** Como pasajero, quiero pagar por mis viajes de forma conveniente, para completar el servicio.

#### Acceptance Criteria

1. THE Passenger_App SHALL allow passengers to register multiple payment methods
2. THE Platform SHALL support cash payments, credit/debit cards, and digital wallets
3. WHEN a ride is completed, THE Passenger_App SHALL display the final fare
4. WHERE the payment method is cash, THE Passenger_App SHALL instruct the passenger to pay the driver directly
5. WHERE the payment method is card or digital wallet, THE Platform SHALL process the payment automatically
6. WHEN a card payment fails, THE Platform SHALL notify the passenger and allow payment retry
7. THE Platform SHALL send payment receipts to passengers via email

### Requirement 11: Valoraciones y Reseñas

**User Story:** Como pasajero, quiero valorar a los conductores, para ayudar a mantener la calidad del servicio.

#### Acceptance Criteria

1. WHEN a ride is completed, THE Passenger_App SHALL prompt the passenger to rate the driver
2. THE Passenger_App SHALL allow passengers to provide a rating from 1 to 5 stars
3. THE Passenger_App SHALL allow passengers to add optional written comments
4. WHEN a ride is completed, THE Driver_App SHALL prompt the driver to rate the passenger
5. THE Driver_App SHALL allow drivers to provide a rating from 1 to 5 stars
6. THE Platform SHALL calculate and store average ratings for drivers and passengers
7. THE Passenger_App SHALL display driver ratings before ride confirmation

### Requirement 12: Panel de Ganancias para Conductores

**User Story:** Como conductor, quiero ver mis ganancias, para llevar control de mis ingresos.

#### Acceptance Criteria

1. THE Driver_App SHALL display total earnings for the current day
2. THE Driver_App SHALL display total earnings for the current week
3. THE Driver_App SHALL display total earnings for the current month
4. THE Driver_App SHALL display a list of completed rides with individual fares
5. THE Driver_App SHALL display the number of completed rides
6. THE Platform SHALL calculate driver earnings as the fare minus platform commission

### Requirement 13: Gestión de Usuarios en Dashboard Administrativo

**User Story:** Como administrador, quiero gestionar usuarios y conductores, para mantener la plataforma operativa.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a list of all registered passengers
2. THE Admin_Dashboard SHALL display a list of all registered drivers
3. THE Admin_Dashboard SHALL allow administrators to search users by name, email, or phone
4. THE Admin_Dashboard SHALL allow administrators to view detailed user profiles
5. THE Admin_Dashboard SHALL allow administrators to suspend user accounts
6. THE Admin_Dashboard SHALL allow administrators to reactivate suspended accounts
7. WHEN an account is suspended, THE Platform SHALL prevent that user from accessing the service

### Requirement 14: Monitoreo de Viajes en Tiempo Real

**User Story:** Como administrador, quiero monitorear viajes activos, para supervisar las operaciones de la plataforma.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a map showing all active rides
2. THE Admin_Dashboard SHALL display driver locations for active rides
3. THE Admin_Dashboard SHALL display ride status for each active ride
4. THE Admin_Dashboard SHALL update the map in real-time as driver locations change
5. THE Admin_Dashboard SHALL allow administrators to view ride details by clicking on map markers

### Requirement 15: Configuración de Tarifas

**User Story:** Como administrador, quiero configurar las tarifas, para ajustar los precios del servicio.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL allow administrators to set the base fare for each vehicle type
2. THE Admin_Dashboard SHALL allow administrators to set the per-kilometer rate for each vehicle type
3. THE Admin_Dashboard SHALL allow administrators to set the per-minute rate for each vehicle type
4. THE Admin_Dashboard SHALL allow administrators to set the platform commission percentage
5. WHERE surge pricing is enabled, THE Admin_Dashboard SHALL allow administrators to configure surge multipliers
6. WHEN fare configuration is updated, THE Platform SHALL apply new rates to subsequent ride requests

### Requirement 16: Reportes y Estadísticas

**User Story:** Como administrador, quiero ver reportes de la plataforma, para tomar decisiones informadas.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display total number of rides for selectable date ranges
2. THE Admin_Dashboard SHALL display total revenue for selectable date ranges
3. THE Admin_Dashboard SHALL display number of active drivers
4. THE Admin_Dashboard SHALL display number of active passengers
5. THE Admin_Dashboard SHALL display average rating for drivers
6. THE Admin_Dashboard SHALL allow administrators to export reports as CSV files
7. THE Admin_Dashboard SHALL display ride completion rate

### Requirement 17: Notificaciones Push

**User Story:** Como usuario del sistema, quiero recibir notificaciones, para estar informado sobre eventos importantes.

#### Acceptance Criteria

1. WHEN a driver accepts a ride, THE Platform SHALL send a push notification to the passenger
2. WHEN a driver arrives at pickup location, THE Platform SHALL send a push notification to the passenger
3. WHEN a ride is completed, THE Platform SHALL send a push notification to the passenger
4. WHEN a new ride request is available, THE Platform SHALL send a push notification to nearby drivers
5. WHEN a driver profile is verified, THE Platform SHALL send a push notification to the driver
6. WHEN a payment is processed, THE Platform SHALL send a push notification to the passenger
7. THE Platform SHALL allow users to enable or disable push notifications in app settings

### Requirement 18: Historial de Viajes

**User Story:** Como pasajero, quiero ver mi historial de viajes, para revisar mis viajes anteriores.

#### Acceptance Criteria

1. THE Passenger_App SHALL display a list of completed rides
2. THE Passenger_App SHALL display ride details including date, pickup location, destination, fare, and driver name
3. THE Passenger_App SHALL allow passengers to filter rides by date range
4. THE Driver_App SHALL display a list of completed rides
5. THE Driver_App SHALL display ride details including date, pickup location, destination, and earnings

### Requirement 19: Disponibilidad de Conductores

**User Story:** Como conductor, quiero controlar mi disponibilidad, para aceptar viajes solo cuando esté listo.

#### Acceptance Criteria

1. THE Driver_App SHALL provide a toggle to set driver status to available or unavailable
2. WHEN a driver sets status to available, THE Platform SHALL include that driver in ride request matching
3. WHEN a driver sets status to unavailable, THE Platform SHALL exclude that driver from ride request matching
4. THE Driver_App SHALL display current availability status prominently
5. WHEN a driver has an active ride, THE Platform SHALL automatically set the driver status to unavailable for new requests

### Requirement 20: Navegación para Conductores

**User Story:** Como conductor, quiero recibir indicaciones de navegación, para llegar al destino eficientemente.

#### Acceptance Criteria

1. WHEN a driver accepts a ride, THE Driver_App SHALL display the route to the pickup location
2. WHEN a driver starts a trip, THE Driver_App SHALL display the route to the destination
3. THE Driver_App SHALL integrate with device navigation services
4. THE Driver_App SHALL allow drivers to open routes in external navigation apps
5. THE Driver_App SHALL update routes in real-time based on traffic conditions

### Requirement 21: Cancelación de Viajes

**User Story:** Como usuario del sistema, quiero poder cancelar viajes, para manejar cambios de planes.

#### Acceptance Criteria

1. WHILE a ride status is "pending" or "accepted", THE Passenger_App SHALL allow passengers to cancel the ride
2. WHILE a ride status is "accepted", THE Driver_App SHALL allow drivers to cancel the ride
3. WHEN a passenger cancels a ride after driver acceptance, THE Platform SHALL apply a cancellation fee
4. WHEN a driver cancels a ride, THE Platform SHALL notify the passenger and create a new ride request
5. THE Platform SHALL not apply cancellation fees if cancellation occurs within 2 minutes of request creation
6. THE Admin_Dashboard SHALL allow administrators to configure cancellation fee amounts

### Requirement 22: Soporte para Múltiples Idiomas

**User Story:** Como usuario, quiero usar la aplicación en mi idioma, para entender mejor la interfaz.

#### Acceptance Criteria

1. THE Passenger_App SHALL support Spanish and English languages
2. THE Driver_App SHALL support Spanish and English languages
3. THE Passenger_App SHALL allow users to change language in app settings
4. THE Driver_App SHALL allow users to change language in app settings
5. THE Platform SHALL detect device language and set it as default on first launch

### Requirement 29: Diseño Visual y Branding

**User Story:** Como usuario, quiero una interfaz visualmente atractiva y consistente, para tener una mejor experiencia de uso.

#### Acceptance Criteria

1. THE Passenger_App SHALL use the UrbanTaxi brand color palette: primary green (#00B300), secondary green (#32CD32), light green (#90EE90), primary orange (#FF9500), light orange (#E6C896)
2. THE Driver_App SHALL use the same UrbanTaxi brand color palette
3. THE Admin_Dashboard SHALL use the same UrbanTaxi brand color palette
4. THE Passenger_App SHALL display the UrbanTaxi logo with green and orange branding
5. THE Driver_App SHALL display the UrbanTaxi logo with green and orange branding
6. THE Passenger_App login screen SHALL include: email/phone input field with green border, password input field with green border and eye icon, "Recuérdame" checkbox, "¿Olvidaste tu Contraseña?" link in green, primary action button "Empezar a viajar" in primary green, registration link "Regístrate aquí" in green, Google and Apple sign-in buttons with white background
7. THE Driver_App login screen SHALL follow the same design pattern as Passenger_App
8. THE Passenger_App SHALL use rounded input fields with green borders
9. THE Passenger_App SHALL use rounded buttons with appropriate colors: primary actions in green (#00B300), secondary actions in light green, cancel actions in orange
10. THE Platform SHALL use gray colors (#A9A9A9, #505050) for text and neutral elements
11. THE Passenger_App SHALL display a welcome message "Bienvenido de vuelta" on login screen
12. THE Passenger_App SHALL display a tagline "¿Listo para tu siguiente destino?" on login screen

### Requirement 23: Gestión de Documentos de Conductores

**User Story:** Como conductor, quiero actualizar mis documentos, para mantener mi perfil verificado.

#### Acceptance Criteria

1. THE Driver_App SHALL allow drivers to view their uploaded verification documents
2. THE Driver_App SHALL allow drivers to upload updated versions of verification documents
3. WHEN a driver uploads updated documents, THE Platform SHALL mark the driver profile as pending re-verification
4. THE Admin_Dashboard SHALL notify administrators when drivers upload updated documents
5. THE Platform SHALL allow drivers to continue accepting rides while re-verification is pending

### Requirement 24: Seguridad y Privacidad de Datos

**User Story:** Como usuario, quiero que mis datos estén protegidos, para mantener mi privacidad.

#### Acceptance Criteria

1. THE Platform SHALL encrypt all passwords using bcrypt or similar hashing algorithm
2. THE Platform SHALL transmit all data over HTTPS connections
3. THE Platform SHALL store payment card information using PCI-DSS compliant methods
4. THE Platform SHALL not display full payment card numbers in any application
5. THE Platform SHALL allow users to delete their accounts and associated data
6. THE Platform SHALL implement rate limiting to prevent brute force attacks

### Requirement 25: Viajes Programados (Opcional)

**User Story:** Como pasajero, quiero programar viajes con anticipación, para asegurar transporte en horarios específicos.

#### Acceptance Criteria

1. WHERE scheduled rides are enabled, THE Passenger_App SHALL allow passengers to select a future date and time for pickup
2. WHERE scheduled rides are enabled, THE Platform SHALL create a scheduled ride request
3. WHERE scheduled rides are enabled, THE Platform SHALL notify nearby drivers 15 minutes before the scheduled time
4. WHERE scheduled rides are enabled, THE Passenger_App SHALL allow passengers to cancel scheduled rides up to 1 hour before pickup time
5. WHERE scheduled rides are enabled, THE Platform SHALL send a reminder notification to passengers 30 minutes before pickup

### Requirement 26: Programa de Fidelización (Opcional)

**User Story:** Como pasajero frecuente, quiero acumular puntos, para obtener beneficios.

#### Acceptance Criteria

1. WHERE loyalty program is enabled, THE Platform SHALL award points to passengers for each completed ride
2. WHERE loyalty program is enabled, THE Platform SHALL calculate points based on fare amount
3. WHERE loyalty program is enabled, THE Passenger_App SHALL display current point balance
4. WHERE loyalty program is enabled, THE Passenger_App SHALL allow passengers to redeem points for ride discounts
5. WHERE loyalty program is enabled, THE Admin_Dashboard SHALL allow administrators to configure point conversion rates

### Requirement 27: Viajes Compartidos (Opcional)

**User Story:** Como pasajero, quiero compartir viajes con otros pasajeros, para reducir costos.

#### Acceptance Criteria

1. WHERE ride sharing is enabled, THE Passenger_App SHALL allow passengers to opt-in to shared rides
2. WHERE ride sharing is enabled, THE Platform SHALL match passengers with similar routes
3. WHERE ride sharing is enabled, THE Platform SHALL calculate discounted fares for shared rides
4. WHERE ride sharing is enabled, THE Passenger_App SHALL display that the ride will be shared before confirmation
5. WHERE ride sharing is enabled, THE Platform SHALL limit shared rides to a maximum of 3 passengers

### Requirement 28: Gamificación para Conductores (Opcional)

**User Story:** Como conductor, quiero alcanzar logros y metas, para sentirme motivado.

#### Acceptance Criteria

1. WHERE gamification is enabled, THE Platform SHALL award badges to drivers for milestones
2. WHERE gamification is enabled, THE Driver_App SHALL display earned badges in driver profile
3. WHERE gamification is enabled, THE Platform SHALL track daily and weekly ride goals
4. WHERE gamification is enabled, THE Driver_App SHALL display progress toward goals
5. WHERE gamification is enabled, THE Platform SHALL award bonus points for achieving goals

## Notes

Este documento define los requisitos funcionales para la plataforma de taxis y moto-taxis. Los requisitos 25-28 son opcionales y pueden implementarse en fases posteriores. Todos los requisitos siguen patrones EARS y cumplen con las reglas de calidad INCOSE para garantizar claridad, precisión y verificabilidad.

La implementación técnica utilizará Expo + React Native para las aplicaciones móviles y Express para el backend, pero los detalles de implementación se definirán en el documento de diseño.
