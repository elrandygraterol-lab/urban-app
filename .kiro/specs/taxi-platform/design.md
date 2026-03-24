# Design Document: Plataforma de Taxis y Moto-Taxis

## Overview

La plataforma de taxis y moto-taxis es un sistema distribuido que conecta pasajeros con conductores a través de aplicaciones móviles multiplataforma. El sistema consta de tres aplicaciones cliente (Passenger App, Driver App, Admin Dashboard) y un backend centralizado que gestiona la lógica de negocio, almacenamiento de datos y comunicación en tiempo real.

### Objetivos del Sistema

- Facilitar la solicitud y asignación de viajes en tiempo real
- Proporcionar seguimiento GPS en vivo de conductores
- Procesar pagos de forma segura mediante múltiples métodos
- Gestionar perfiles de usuarios con verificación de documentos
- Ofrecer herramientas administrativas para monitoreo y configuración
- Garantizar escalabilidad para soportar miles de usuarios concurrentes
- Desplegar en Android, iOS y Web desde una única base de código

### Alcance

El diseño cubre:
- Arquitectura de microservicios con backend Express
- Aplicaciones móviles con Expo + React Native
- Dashboard web administrativo
- Sistema de geolocalización y matching de viajes
- Procesamiento de pagos y gestión de tarifas
- Sistema de notificaciones push
- Estrategia de despliegue multiplataforma

## Architecture

### High-Level Architecture

El sistema sigue una arquitectura cliente-servidor con los siguientes componentes principales:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Passenger App  │     │   Driver App    │     │ Admin Dashboard │
│  (Expo/RN)      │     │   (Expo/RN)     │     │   (Expo Web)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                                 │ HTTPS/WSS
                                 │
                    ┌────────────▼────────────┐
                    │   API Gateway/LB        │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌────────▼────────┐   ┌─────────▼────────┐   ┌─────────▼────────┐
│  Auth Service   │   │  Ride Service    │   │  Payment Service │
│  (Express)      │   │  (Express)       │   │  (Express)       │
└────────┬────────┘   └─────────┬────────┘   └─────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   PostgreSQL Database   │
                    └─────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Redis Cache/PubSub    │
                    └─────────────────────────┘
```

### Technology Stack

#### Frontend (Mobile & Web)
- **Framework**: Expo SDK 50+ con React Native
- **Navegación**: React Navigation 6.x
- **Estado Global**: Zustand o Redux Toolkit
- **Mapas**: react-native-maps (Google Maps/Apple Maps)
- **Geolocalización**: expo-location
- **Notificaciones**: expo-notifications + Firebase Cloud Messaging
- **HTTP Client**: Axios con interceptores
- **WebSockets**: Socket.io-client para actualizaciones en tiempo real
- **UI Components**: React Native Paper o NativeBase
- **Formularios**: React Hook Form + Zod para validación
- **Branding**: UrbanTaxi color palette (green and orange theme)

#### Backend
- **Runtime**: Node.js 18+ LTS
- **Framework**: Express.js 4.x
- **Base de Datos**: PostgreSQL 15+ con PostGIS para datos geoespaciales
- **ORM**: Prisma o TypeORM
- **Cache**: Redis 7+ para sesiones y pub/sub
- **Autenticación**: JWT con refresh tokens
- **WebSockets**: Socket.io para comunicación en tiempo real
- **Validación**: Zod o Joi
- **Logging**: Winston o Pino
- **Procesamiento de Pagos**: integración con bancos locales de venezuela (pago movil,transferencia bancaria,dinero en efectivo)
- **File Storage**: AWS S3 o Cloudinary para documentos

#### Infrastructure & DevOps
- **Containerización**: Docker + Docker Compose
- **Orquestación**: Kubernetes (opcional para producción)
- **CI/CD**: GitHub Actions o GitLab CI
- **Monitoreo**: Sentry para errores, Prometheus + Grafana para métricas
- **Hosting Backend**: AWS EC2/ECS, DigitalOcean, o Railway
- **Hosting Web**:  Netlify
- **CDN**: CloudFlare para assets estáticos 
- Build con EAS Build (Expo Application Services)
- Distribución vía Google Play Store
- Configuración de Google Maps API Key
- Firebase Cloud Messaging para notificaciones push
- Firma de APK/AAB con keystore seguro

#### iOS
- Build con EAS Build
- Distribución vía Apple App Store
- Configuración de Apple Maps
- APNs (Apple Push Notification service)
- Certificados y provisioning profiles gestionados por EAS

#### Web
- Build con `expo export:web` o `npx expo export --platform web`
- Despliegue en Netlify con configuración SPA
- PWA capabilities para instalación en escritorio
- Mapas con Google Maps JavaScript API
- Web Push Notifications API

### Architectural Patterns

1. **RESTful API**: Para operaciones CRUD estándar
2. **WebSocket/Socket.io**: Para actualizaciones en tiempo real (ubicación, estado de viajes)
3. **Event-Driven**: Redis Pub/Sub para comunicación entre servicios
4. **Repository Pattern**: Abstracción de acceso a datos
5. **Service Layer**: Lógica de negocio separada de controladores
6. **Middleware Pattern**: Autenticación, validación, logging

## Components and Interfaces

### Frontend Components

#### Design System & Branding

**Color Palette (UrbanTaxi)**:
- Primary Green: #00B300 (main actions, primary buttons)
- Secondary Green: #32CD32 (hover states, secondary elements)
- Light Green: #90EE90 (backgrounds, subtle highlights)
- Primary Orange: #FF9500 (cancel actions, warnings, accent)
- Light Orange: #E6C896 (hover cancel states)
- Dark Gray: #505050 (headings, primary text)
- Light Gray: #A9A9A9 (secondary text, placeholders)
- White: #FFFFFF (backgrounds, cards)

**Typography**:
- H1: Bold, Dark Gray (#505050)
- H2: Semi-bold, Dark Gray (#505050)
- Body: Regular, Dark Gray (#505050)
- Input Placeholder: Light Gray (#A9A9A9)

**Component Styles**:
- Input Fields: White background, green border (#00B300), rounded corners (24px)
- Primary Buttons: Green background (#00B300), white text, rounded (24px), hover: #32CD32
- Cancel Buttons: Orange background (#FF9500), white text, rounded (24px), hover: #E6C896
- Cards: White background, subtle shadow, rounded corners (16px)
- Icons: Green (#00B300) for primary actions, Orange (#FF9500) for warnings

**Login/Register Screen Design**:
- Top section: UrbanTaxi logo with green and orange branding
- Tagline: "¿Listo para tu siguiente destino?"
- Welcome message: "Bienvenido de vuelta"
- Input fields: Rounded with green borders, placeholder text in light gray
- Password field: Eye icon for show/hide
- "Recuérdame" checkbox with green accent
- "¿Olvidaste tu Contraseña?" link in green
- Primary button: "Empezar a viajar" in primary green
- Registration link: "¿Aún no tienes una cuenta? Regístrate aquí." with green accent
- Social login: Google and Apple buttons with white background and respective logos

#### Passenger App Modules

1. **Authentication Module**
   - LoginScreen (siguiendo diseño UrbanTaxi)
   - RegisterScreen (siguiendo diseño UrbanTaxi)
   - ForgotPasswordScreen
   - Components: InputField (green borders), AuthButton (green), SocialLoginButtons (Google/Apple)

2. **Home/Ride Request Module**
   - MapScreen (pantalla principal)
   - LocationSearchInput
   - VehicleTypeSelector
   - FareEstimateCard
   - ConfirmRideButton
   - Components: MapView, MarkerComponent, RoutePolyline

3. **Active Ride Module**
   - RideTrackingScreen
   - DriverInfoCard
   - RideStatusIndicator
   - CancelRideButton
   - ChatWithDriverButton (opcional)

4. **Payment Module**
   - PaymentMethodsScreen
   - AddPaymentMethodScreen
   - PaymentMethodCard
   - Components: CardInput, WalletSelector

5. **History Module**
   - RideHistoryScreen
   - RideHistoryCard
   - RideDetailsModal
   - FilterByDatePicker

6. **Profile Module**
   - ProfileScreen
   - EditProfileScreen
   - SettingsScreen
   - LanguageSelector
   - NotificationSettings

7. **Rating Module**
   - RatingModal
   - StarRating Component
   - CommentInput

#### Driver App Modules

1. **Authentication Module** (similar a Passenger App)

2. **Registration/Verification Module**
   - DriverRegistrationScreen
   - DocumentUploadScreen
   - VehicleInfoForm
   - DocumentCamera Component
   - VerificationStatusScreen

3. **Home/Availability Module**
   - DriverMapScreen
   - AvailabilityToggle
   - IncomingRideRequestCard
   - AcceptRejectButtons

4. **Active Ride Module**
   - RideDetailsScreen
   - NavigationView
   - RideStatusButtons (Arrived, Start Trip, Complete Trip)
   - PassengerInfoCard

5. **Earnings Module**
   - EarningsScreen
   - EarningsSummaryCard (day/week/month)
   - RideEarningsListItem
   - EarningsChart

6. **Profile Module**
   - DriverProfileScreen
   - DocumentsScreen
   - VehicleInfoScreen
   - RatingDisplay

#### Admin Dashboard Modules

1. **Authentication Module**
   - AdminLoginScreen

2. **Dashboard Overview**
   - StatisticsCards (total rides, revenue, active users)
   - RevenueChart
   - RideCompletionChart
   - RecentActivityFeed

3. **User Management Module**
   - UsersListScreen (passengers)
   - DriversListScreen
   - UserDetailsModal
   - SearchBar
   - SuspendUserButton

4. **Driver Verification Module**
   - PendingVerificationsScreen
   - DriverDocumentsViewer
   - ApproveRejectButtons
   - RejectionReasonModal

5. **Live Monitoring Module**
   - LiveMapScreen
   - ActiveRidesMarkers
   - RideDetailsPanel
   - FilterControls

6. **Configuration Module**
   - FareConfigScreen
   - VehicleTypeFareForm
   - CommissionSettings
   - SurgePricingConfig
   - CancellationFeeSettings

7. **Reports Module**
   - ReportsScreen
   - DateRangePicker
   - ExportCSVButton
   - ReportCharts

### Backend Services

#### 1. Auth Service

**Responsibilities:**
- Registro y autenticación de usuarios
- Generación y validación de JWT tokens
- Gestión de sesiones
- Recuperación de contraseñas
- Refresh token rotation

**Endpoints:**
```
POST   /api/auth/register/passenger
POST   /api/auth/register/driver
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/me
```

#### 2. User Service

**Responsibilities:**
- Gestión de perfiles de pasajeros
- Gestión de perfiles de conductores
- Actualización de información personal
- Gestión de documentos de verificación
- Suspensión y reactivación de cuentas

**Endpoints:**
```
GET    /api/users/passengers
GET    /api/users/passengers/:id
PUT    /api/users/passengers/:id
DELETE /api/users/passengers/:id
GET    /api/users/drivers
GET    /api/users/drivers/:id
PUT    /api/users/drivers/:id
POST   /api/users/drivers/:id/documents
GET    /api/users/drivers/:id/documents
PUT    /api/users/drivers/:id/verify
PUT    /api/users/drivers/:id/suspend
```

#### 3. Ride Service

**Responsibilities:**
- Creación de solicitudes de viaje
- Matching de conductores cercanos
- Gestión de estados de viaje
- Cálculo de tarifas
- Seguimiento de ubicación en tiempo real
- Cancelación de viajes

**Endpoints:**
```
POST   /api/rides/request
POST   /api/rides/:id/accept
POST   /api/rides/:id/reject
POST   /api/rides/:id/arrive
POST   /api/rides/:id/start
POST   /api/rides/:id/complete
POST   /api/rides/:id/cancel
GET    /api/rides/:id
GET    /api/rides/active
GET    /api/rides/history
POST   /api/rides/:id/location
GET    /api/rides/nearby-drivers
```

**WebSocket Events:**
```
// Emitted by server
ride:request_created
ride:accepted
ride:driver_location_update
ride:status_changed
ride:cancelled

// Emitted by clients
driver:location_update
driver:availability_changed
```

#### 4. Payment Service

**Responsibilities:**
- Gestión de métodos de pago
- Procesamiento de pagos
- Cálculo de comisiones
- Generación de recibos
- Gestión de reembolsos

**Endpoints:**
```
GET    /api/payments/methods
POST   /api/payments/methods
DELETE /api/payments/methods/:id
POST   /api/payments/process
GET    /api/payments/receipts/:rideId
POST   /api/payments/refund
```

#### 5. Rating Service

**Responsibilities:**
- Gestión de valoraciones de conductores
- Gestión de valoraciones de pasajeros
- Cálculo de promedios de rating
- Almacenamiento de comentarios

**Endpoints:**
```
POST   /api/ratings/driver
POST   /api/ratings/passenger
GET    /api/ratings/driver/:id
GET    /api/ratings/passenger/:id
```

#### 6. Notification Service

**Responsibilities:**
- Envío de notificaciones push
- Gestión de tokens de dispositivos
- Plantillas de notificaciones
- Preferencias de notificaciones

**Endpoints:**
```
POST   /api/notifications/register-device
POST   /api/notifications/send
PUT    /api/notifications/preferences
```

#### 7. Admin Service

**Responsibilities:**
- Estadísticas y reportes
- Configuración de tarifas
- Monitoreo de viajes activos
- Gestión de usuarios
- Exportación de datos

**Endpoints:**
```
GET    /api/admin/statistics
GET    /api/admin/rides/active
GET    /api/admin/reports
POST   /api/admin/reports/export
GET    /api/admin/fare-config
PUT    /api/admin/fare-config
GET    /api/admin/drivers/pending-verification
```

### External Integrations

1. **Google Maps Platform**
   - Maps SDK for Android/iOS
   - Maps JavaScript API (Web)
   - Directions API
   - Distance Matrix API
   - Geocoding API

2. **Payment Gateway**
   - Stripe API (recomendado para internacional)
   - O pasarela local según región

3. **Push Notifications**
   - Firebase Cloud Messaging (Android/iOS)
   - Web Push API (Web)

4. **File Storage**
   - AWS S3 o Cloudinary para documentos de conductores

5. **Email Service**
   - SendGrid o AWS SES para emails transaccionales

## Data Models

### Database Schema (PostgreSQL)

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('passenger', 'driver', 'admin')),
  name VARCHAR(255) NOT NULL,
  profile_photo_url TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  language VARCHAR(5) DEFAULT 'es',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
```

#### Driver Profiles Table
```sql
CREATE TABLE driver_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('taxi', 'moto-taxi')),
  license_plate VARCHAR(20) NOT NULL,
  vehicle_model VARCHAR(100) NOT NULL,
  vehicle_color VARCHAR(50),
  vehicle_year INTEGER,
  verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  rejection_reason TEXT,
  is_available BOOLEAN DEFAULT false,
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  last_location_update TIMESTAMP,
  average_rating DECIMAL(3, 2) DEFAULT 0.00,
  total_rides INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_driver_profiles_user_id ON driver_profiles(user_id);
CREATE INDEX idx_driver_profiles_verification_status ON driver_profiles(verification_status);
CREATE INDEX idx_driver_profiles_is_available ON driver_profiles(is_available);

-- PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE driver_profiles ADD COLUMN location GEOGRAPHY(POINT, 4326);
CREATE INDEX idx_driver_profiles_location ON driver_profiles USING GIST(location);
```

#### Verification Documents Table
```sql
CREATE TABLE verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('drivers_license', 'vehicle_registration', 'insurance', 'vehicle_photo_front', 'vehicle_photo_back', 'vehicle_photo_side')),
  document_url TEXT NOT NULL,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  verified_at TIMESTAMP,
  verified_by UUID REFERENCES users(id)
);

CREATE INDEX idx_verification_documents_driver_id ON verification_documents(driver_id);
```

#### Passenger Profiles Table
```sql
CREATE TABLE passenger_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  average_rating DECIMAL(3, 2) DEFAULT 0.00,
  total_rides INTEGER DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_passenger_profiles_user_id ON passenger_profiles(user_id);
```

#### Rides Table
```sql
CREATE TABLE rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL REFERENCES passenger_profiles(id),
  driver_id UUID REFERENCES driver_profiles(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled')),
  vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('taxi', 'moto-taxi')),
  
  pickup_latitude DECIMAL(10, 8) NOT NULL,
  pickup_longitude DECIMAL(11, 8) NOT NULL,
  pickup_address TEXT NOT NULL,
  
  destination_latitude DECIMAL(10, 8) NOT NULL,
  destination_longitude DECIMAL(11, 8) NOT NULL,
  destination_address TEXT NOT NULL,
  
  estimated_distance_km DECIMAL(10, 2),
  estimated_duration_minutes INTEGER,
  estimated_fare DECIMAL(10, 2),
  
  actual_distance_km DECIMAL(10, 2),
  actual_duration_minutes INTEGER,
  final_fare DECIMAL(10, 2),
  
  cancellation_reason TEXT,
  cancelled_by VARCHAR(20) CHECK (cancelled_by IN ('passenger', 'driver', 'system')),
  cancellation_fee DECIMAL(10, 2) DEFAULT 0.00,
  
  scheduled_pickup_time TIMESTAMP,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  arrived_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rides_passenger_id ON rides(passenger_id);
CREATE INDEX idx_rides_driver_id ON rides(driver_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_created_at ON rides(created_at);
```

#### Payment Methods Table
```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method_type VARCHAR(20) NOT NULL CHECK (method_type IN ('cash', 'card', 'digital_wallet')),
  is_default BOOLEAN DEFAULT false,
  
  -- For card payments
  card_last_four VARCHAR(4),
  card_brand VARCHAR(20),
  card_token TEXT, -- Stripe token or similar
  
  -- For digital wallets
  wallet_provider VARCHAR(50),
  wallet_identifier TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
```

#### Payments Table
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID UNIQUE NOT NULL REFERENCES rides(id),
  payment_method_id UUID REFERENCES payment_methods(id),
  amount DECIMAL(10, 2) NOT NULL,
  platform_commission DECIMAL(10, 2) NOT NULL,
  driver_earnings DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  transaction_id TEXT,
  payment_gateway_response JSONB,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_ride_id ON payments(ride_id);
CREATE INDEX idx_payments_status ON payments(status);
```

#### Ratings Table
```sql
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id),
  rater_id UUID NOT NULL REFERENCES users(id),
  rated_id UUID NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ratings_ride_id ON ratings(ride_id);
CREATE INDEX idx_ratings_rated_id ON ratings(rated_id);
```

#### Fare Configuration Table
```sql
CREATE TABLE fare_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('taxi', 'moto-taxi')),
  base_fare DECIMAL(10, 2) NOT NULL,
  per_km_rate DECIMAL(10, 2) NOT NULL,
  per_minute_rate DECIMAL(10, 2) NOT NULL,
  platform_commission_percentage DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
  cancellation_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  surge_multiplier DECIMAL(3, 2) DEFAULT 1.00,
  is_active BOOLEAN DEFAULT true,
  effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fare_config_vehicle_type ON fare_config(vehicle_type);
CREATE INDEX idx_fare_config_is_active ON fare_config(is_active);
```

#### Notification Tokens Table
```sql
CREATE TABLE notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_tokens_user_id ON notification_tokens(user_id);
CREATE INDEX idx_notification_tokens_token ON notification_tokens(token);
```

### Data Transfer Objects (DTOs)

#### Ride Request DTO
```typescript
interface RideRequestDTO {
  passengerId: string;
  vehicleType: 'taxi' | 'moto-taxi';
  pickup: {
    latitude: number;
    longitude: number;
    address: string;
  };
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
  scheduledPickupTime?: Date;
  paymentMethodId: string;
}
```

#### Ride Response DTO
```typescript
interface RideResponseDTO {
  id: string;
  status: RideStatus;
  passenger: {
    id: string;
    name: string;
    phone: string;
    rating: number;
  };
  driver?: {
    id: string;
    name: string;
    phone: string;
    rating: number;
    vehicleInfo: {
      type: string;
      model: string;
      licensePlate: string;
      color: string;
    };
    currentLocation?: {
      latitude: number;
      longitude: number;
    };
  };
  pickup: LocationDTO;
  destination: LocationDTO;
  estimatedFare: number;
  finalFare?: number;
  timestamps: {
    requested: Date;
    accepted?: Date;
    arrived?: Date;
    started?: Date;
    completed?: Date;
  };
}
```

### Key Algorithms

#### 1. Driver Matching Algorithm

```typescript
async function findNearbyDrivers(
  pickupLocation: { latitude: number; longitude: number },
  vehicleType: 'taxi' | 'moto-taxi',
  radiusKm: number = 5
): Promise<Driver[]> {
  // Using PostGIS for geospatial query
  const query = `
    SELECT 
      dp.*,
      ST_Distance(
        dp.location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) / 1000 as distance_km
    FROM driver_profiles dp
    WHERE 
      dp.is_available = true
      AND dp.verification_status = 'verified'
      AND dp.vehicle_type = $3
      AND ST_DWithin(
        dp.location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $4 * 1000
      )
    ORDER BY distance_km ASC
    LIMIT 20
  `;
  
  return await db.query(query, [
    pickupLocation.longitude,
    pickupLocation.latitude,
    vehicleType,
    radiusKm
  ]);
}
```

#### 2. Fare Calculation Algorithm

```typescript
async function calculateFare(
  distanceKm: number,
  durationMinutes: number,
  vehicleType: 'taxi' | 'moto-taxi',
  isEstimate: boolean = false
): Promise<number> {
  // Get active fare configuration
  const fareConfig = await getFareConfig(vehicleType);
  
  // Base calculation
  let fare = fareConfig.baseFare;
  fare += distanceKm * fareConfig.perKmRate;
  fare += durationMinutes * fareConfig.perMinuteRate;
  
  // Apply surge pricing if applicable
  if (await isSurgePricingActive()) {
    fare *= fareConfig.surgeMultiplier;
  }
  
  // Round to 2 decimals
  return Math.round(fare * 100) / 100;
}

async function isSurgePricingActive(): Promise<boolean> {
  // Check if demand is high
  const activeRides = await getActiveRidesCount();
  const availableDrivers = await getAvailableDriversCount();
  
  const demandRatio = activeRides / Math.max(availableDrivers, 1);
  
  // Activate surge if demand ratio > 2
  return demandRatio > 2;
}
```

#### 3. Real-time Location Update Handler

```typescript
// Socket.io event handler
io.on('connection', (socket) => {
  socket.on('driver:location_update', async (data: {
    driverId: string;
    latitude: number;
    longitude: number;
  }) => {
    // Update driver location in database
    await updateDriverLocation(
      data.driverId,
      data.latitude,
      data.longitude
    );
    
    // Get driver's active ride
    const activeRide = await getDriverActiveRide(data.driverId);
    
    if (activeRide) {
      // Broadcast location to passenger
      io.to(`ride:${activeRide.id}`).emit('driver:location_update', {
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: new Date()
      });
      
      // Calculate ETA
      const eta = await calculateETA(
        { latitude: data.latitude, longitude: data.longitude },
        activeRide.status === 'accepted' 
          ? activeRide.pickupLocation 
          : activeRide.destinationLocation
      );
      
      io.to(`ride:${activeRide.id}`).emit('ride:eta_update', { eta });
    }
  });
});
```

#### 4. Ride Request Notification Algorithm

```typescript
async function notifyNearbyDrivers(ride: Ride): Promise<void> {
  // Find nearby available drivers
  const drivers = await findNearbyDrivers(
    ride.pickupLocation,
    ride.vehicleType,
    5 // 5km radius
  );
  
  // Sort by rating and distance
  const sortedDrivers = drivers.sort((a, b) => {
    const scoreA = a.averageRating * 0.7 + (1 / a.distanceKm) * 0.3;
    const scoreB = b.averageRating * 0.7 + (1 / b.distanceKm) * 0.3;
    return scoreB - scoreA;
  });
  
  // Send push notifications to top 10 drivers
  const notificationPromises = sortedDrivers.slice(0, 10).map(driver =>
    sendPushNotification(driver.userId, {
      title: 'Nueva solicitud de viaje',
      body: `Viaje a ${ride.destination.address}`,
      data: {
        rideId: ride.id,
        estimatedFare: ride.estimatedFare,
        distance: driver.distanceKm
      }
    })
  );
  
  await Promise.all(notificationPromises);
  
  // Set timeout to cancel if no acceptance
  setTimeout(async () => {
    const updatedRide = await getRide(ride.id);
    if (updatedRide.status === 'pending') {
      await cancelRide(ride.id, 'system', 'No drivers available');
      await notifyPassenger(ride.passengerId, 'ride_cancelled');
    }
  }, 120000); // 2 minutes
}
```

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid Registration Creates Account

*For any* valid passenger registration data (valid email format, valid phone format, password ≥8 characters, unique email and phone), submitting the registration should create a new passenger account in the system.

**Validates: Requirements 1.2, 1.4, 1.5, 1.6**

### Property 2: Duplicate Credentials Rejected

*For any* registration attempt using an email or phone number that already exists in the system, the registration should be rejected with an appropriate error message.

**Validates: Requirements 1.3**

### Property 3: Authentication Token Generation

*For any* valid user credentials (existing email and correct password), authentication should return a valid access token that can be used for subsequent requests.

**Validates: Requirements 2.3**

### Property 4: Invalid Credentials Rejected

*For any* invalid credentials (non-existent email or incorrect password), authentication should return an error and not generate a token.

**Validates: Requirements 2.4**

### Property 5: Password Recovery Token Generation

*For any* registered user email, requesting password recovery should generate a valid recovery token that can be used to reset the password.

**Validates: Requirements 2.6**

### Property 6: Driver Registration Creates Pending Account

*For any* valid driver registration data (including vehicle information), submitting the registration should create a driver account with status "pending" verification.

**Validates: Requirements 3.2**

### Property 7: Document Completeness Validation

*For any* driver profile, the profile should be marked as incomplete if any of the required documents (driver's license, vehicle registration, insurance certificate, vehicle photos) are missing.

**Validates: Requirements 3.4**

### Property 8: Document Upload Triggers Verification Status

*For any* driver profile, when all required documents are uploaded, the profile status should automatically change to "pending verification".

**Validates: Requirements 3.5**

### Property 9: Unverified Drivers Cannot Accept Rides

*For any* driver with verification status other than "verified", attempting to accept a ride request should be rejected by the system.

**Validates: Requirements 3.6, 4.5**

### Property 10: Admin Approval Changes Driver Status

*For any* driver profile in "pending" status, when an administrator approves it, the status should change to "verified" and the driver should be able to receive ride requests.

**Validates: Requirements 4.3**

### Property 11: Admin Rejection Stores Reason

*For any* driver profile in "pending" status, when an administrator rejects it with a reason, the status should change to "rejected" and the rejection reason should be stored.

**Validates: Requirements 4.4**

### Property 12: Fare Calculation Includes All Components

*For any* ride request with distance, duration, and vehicle type, the estimated fare should equal: base_fare + (distance × per_km_rate) + (duration × per_minute_rate), optionally multiplied by surge_multiplier if surge pricing is active.

**Validates: Requirements 5.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7**

### Property 13: Ride Request Creates Ride and Notifies Drivers

*For any* valid ride request, the system should create a ride record with status "pending" and send notifications to available drivers within the specified radius.

**Validates: Requirements 5.5, 8.1**

### Property 14: Geospatial Filtering of Drivers

*For any* ride request with pickup location, only drivers within 5 kilometers of the pickup location should receive ride request notifications.

**Validates: Requirements 5.6**

### Property 15: Driver Acceptance Assigns Ride

*For any* pending ride request, when a driver accepts it, the ride should be assigned to that driver, the status should change to "accepted", and the passenger should be notified.

**Validates: Requirements 6.3, 6.4, 8.2**

### Property 16: Assignment Cancels Other Notifications

*For any* ride request, when it is assigned to a driver, all pending notifications to other drivers should be cancelled or marked as expired.

**Validates: Requirements 6.5**

### Property 17: Ride State Machine Transitions

*For any* ride, state transitions should follow the valid sequence: pending → accepted → arrived → in_progress → completed, or any state before in_progress → cancelled. Invalid transitions should be rejected.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7**

### Property 18: ETA Calculation for Active Rides

*For any* active ride (status: accepted, arrived, or in_progress), the system should calculate and provide an estimated time of arrival based on current location and destination.

**Validates: Requirements 7.5**

### Property 19: Payment Method Support

*For any* payment method registration, the system should accept and store cash, credit/debit card, and digital wallet payment methods.

**Validates: Requirements 10.2**

### Property 20: Automatic Payment Processing

*For any* completed ride with a non-cash payment method, the system should automatically process the payment without manual intervention.

**Validates: Requirements 10.5**

### Property 21: Failed Payment Notification

*For any* payment attempt that fails, the system should notify the passenger and allow retry of the payment.

**Validates: Requirements 10.6**

### Property 22: Payment Receipt Generation

*For any* successfully processed payment, the system should generate and send a receipt to the passenger via email.

**Validates: Requirements 10.7**

### Property 23: Rating Value Validation

*For any* rating submission (driver or passenger), the system should only accept integer values between 1 and 5 inclusive.

**Validates: Requirements 11.2, 11.5**

### Property 24: Average Rating Calculation

*For any* user (driver or passenger) with multiple ratings, the average rating should equal the sum of all ratings divided by the number of ratings, rounded to two decimal places.

**Validates: Requirements 11.6**

### Property 25: Driver Earnings Calculation

*For any* completed ride, the driver's earnings should equal the final fare minus the platform commission (fare × commission_percentage).

**Validates: Requirements 12.6**

### Property 26: User Search Functionality

*For any* search query (name, email, or phone), the system should return all users whose name, email, or phone number contains the search term (case-insensitive).

**Validates: Requirements 13.3**

### Property 27: Account Suspension Blocks Access

*For any* user account with status "suspended", all authentication attempts and service access should be denied.

**Validates: Requirements 13.5, 13.7**

### Property 28: Account Reactivation Restores Access

*For any* suspended user account, when an administrator reactivates it, the status should change to "active" and the user should be able to access services again.

**Validates: Requirements 13.6**

### Property 29: Fare Configuration Persistence

*For any* fare configuration update (base fare, per-km rate, per-minute rate, commission percentage, surge multiplier), the new values should be stored and applied to all subsequent ride requests.

**Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6**

### Property 30: CSV Export Generation

*For any* report data, the system should be able to generate a valid CSV file containing all the report data with proper headers and formatting.

**Validates: Requirements 16.6**

### Property 31: Ride Completion Rate Calculation

*For any* set of rides in a time period, the completion rate should equal (number of completed rides / total number of rides) × 100.

**Validates: Requirements 16.7**

### Property 32: Critical Events Trigger Notifications

*For any* critical ride event (driver acceptance, driver arrival, ride completion, payment processing, driver verification), the system should send a push notification to the relevant user(s).

**Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5, 17.6**

### Property 33: Notification Preferences Respected

*For any* user who has disabled push notifications in settings, the system should not send push notifications to that user's devices.

**Validates: Requirements 17.7**

### Property 34: Ride History Filtering

*For any* date range filter applied to ride history, the system should return only rides where the ride date falls within the specified start and end dates (inclusive).

**Validates: Requirements 18.3**

### Property 35: Driver Availability Controls Matching

*For any* driver, the driver should receive ride request notifications if and only if their status is "available" and they have no active ride.

**Validates: Requirements 19.2, 19.3, 19.5**

### Property 36: Cancellation Allowed by State

*For any* ride, passengers should be able to cancel if status is "pending" or "accepted", and drivers should be able to cancel if status is "accepted". Cancellation should not be allowed once status is "in_progress".

**Validates: Requirements 21.1, 21.2, 8.6**

### Property 37: Late Cancellation Fee Applied

*For any* ride cancelled by a passenger after driver acceptance and more than 2 minutes after request creation, a cancellation fee should be applied.

**Validates: Requirements 21.3, 21.5**

### Property 38: Driver Cancellation Triggers Re-request

*For any* ride cancelled by a driver, the system should notify the passenger and create a new ride request with the same pickup and destination.

**Validates: Requirements 21.4**

### Property 39: Cancellation Fee Configuration

*For any* cancellation fee amount configured by administrators, the new fee amount should be stored and applied to subsequent cancellations.

**Validates: Requirements 21.6**

### Property 40: Device Language Detection

*For any* new user on first app launch, the system should detect the device's language setting and set it as the default app language if supported.

**Validates: Requirements 22.5**

### Property 58: Brand Color Consistency

*For any* UI component in the Passenger_App, Driver_App, or Admin_Dashboard, the component should use colors from the UrbanTaxi brand palette (greens: #00B300, #32CD32, #90EE90; oranges: #FF9500, #E6C896; grays: #505050, #A9A9A9).

**Validates: Requirements 29.1, 29.2, 29.3**

### Property 59: Login Screen Design Compliance

*For any* login screen (Passenger_App or Driver_App), the screen should include all required elements: logo, tagline, welcome message, email/phone input with green border, password input with eye icon, "Recuérdame" checkbox, "¿Olvidaste tu Contraseña?" link, primary button "Empezar a viajar", registration link, and Google/Apple sign-in buttons.

**Validates: Requirements 29.6, 29.7, 29.8, 29.9, 29.11, 29.12**

### Property 41: Document Update Triggers Re-verification

*For any* verified driver who uploads updated verification documents, the driver's verification status should change to "pending re-verification" while still allowing the driver to accept rides.

**Validates: Requirements 23.2, 23.3, 23.5**

### Property 42: Document Update Notifies Admins

*For any* driver document update, the system should send a notification to administrators indicating that new documents require review.

**Validates: Requirements 23.4**

### Property 43: Password Hashing

*For any* user password stored in the database, the password should be hashed using bcrypt or similar algorithm, never stored in plain text.

**Validates: Requirements 24.1**

### Property 44: Card Number Masking

*For any* payment card number displayed in any application interface, only the last 4 digits should be visible, with the rest masked.

**Validates: Requirements 24.4**

### Property 45: Account Deletion Removes Data

*For any* user account deletion request, the system should remove or anonymize all associated personal data from the database.

**Validates: Requirements 24.5**

### Property 46: Rate Limiting Protection

*For any* authentication endpoint, the system should block requests from an IP address or user after a configured number of failed attempts within a time window.

**Validates: Requirements 24.6**

### Property 47: Scheduled Ride Creation (Optional)

*For any* scheduled ride request with a future pickup time, the system should create a ride with status "scheduled" and trigger driver notifications 15 minutes before the scheduled time.

**Validates: Requirements 25.2, 25.3**

### Property 48: Scheduled Ride Cancellation Window (Optional)

*For any* scheduled ride, passengers should be able to cancel without penalty if cancellation occurs more than 1 hour before the scheduled pickup time.

**Validates: Requirements 25.4**

### Property 49: Loyalty Points Award (Optional)

*For any* completed ride when loyalty program is enabled, the system should award points to the passenger based on the fare amount using the configured conversion rate.

**Validates: Requirements 26.1, 26.2**

### Property 50: Points Redemption (Optional)

*For any* points redemption request when loyalty program is enabled, the system should deduct the points from the passenger's balance and apply the corresponding discount to the ride fare.

**Validates: Requirements 26.4**

### Property 51: Loyalty Points Configuration (Optional)

*For any* loyalty points conversion rate configured by administrators, the new rate should be stored and applied to subsequent point calculations.

**Validates: Requirements 26.5**

### Property 52: Shared Ride Matching (Optional)

*For any* two ride requests with shared ride enabled, if the pickup and destination locations are within a configured distance threshold and timing is compatible, the system should match them as a shared ride.

**Validates: Requirements 27.2**

### Property 53: Shared Ride Discount (Optional)

*For any* shared ride, each passenger's fare should be discounted by a configured percentage compared to a non-shared ride with the same route.

**Validates: Requirements 27.3**

### Property 54: Shared Ride Passenger Limit (Optional)

*For any* shared ride, the system should not allow more than 3 passengers to be matched together.

**Validates: Requirements 27.5**

### Property 55: Gamification Badge Awards (Optional)

*For any* driver milestone achievement (e.g., 100 rides, 500 rides, 5-star average), the system should award the corresponding badge to the driver's profile.

**Validates: Requirements 28.1**

### Property 56: Gamification Goal Tracking (Optional)

*For any* driver with gamification enabled, the system should track progress toward daily and weekly ride goals and update the progress in real-time.

**Validates: Requirements 28.3**

### Property 57: Gamification Bonus Awards (Optional)

*For any* driver who achieves a daily or weekly goal, the system should award bonus points according to the configured bonus structure.

**Validates: Requirements 28.5**

## Error Handling

### Error Categories

1. **Validation Errors (400 Bad Request)**
   - Invalid input format (email, phone, coordinates)
   - Missing required fields
   - Invalid enum values
   - Constraint violations (password length, rating range)

2. **Authentication Errors (401 Unauthorized)**
   - Invalid credentials
   - Expired tokens
   - Missing authentication headers
   - Revoked tokens

3. **Authorization Errors (403 Forbidden)**
   - Unverified driver attempting to accept rides
   - Suspended user attempting to access services
   - User attempting unauthorized actions
   - Invalid role for operation

4. **Resource Not Found (404 Not Found)**
   - Non-existent user, ride, or payment
   - Invalid ride ID in requests
   - Deleted or archived resources

5. **Conflict Errors (409 Conflict)**
   - Duplicate email or phone registration
   - Ride already accepted by another driver
   - Invalid state transition
   - Concurrent modification conflicts

6. **Business Logic Errors (422 Unprocessable Entity)**
   - No drivers available in area
   - Payment processing failed
   - Cancellation not allowed in current state
   - Insufficient loyalty points for redemption

7. **Rate Limiting (429 Too Many Requests)**
   - Exceeded authentication attempts
   - Too many API requests in time window
   - Spam detection triggered

8. **Server Errors (500 Internal Server Error)**
   - Database connection failures
   - External service failures (payment gateway, maps API)
   - Unexpected exceptions
   - Data corruption

### Error Response Format

All API errors should follow a consistent JSON structure:

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable error message
    details?: any;          // Additional error context
    field?: string;         // Field name for validation errors
    timestamp: string;      // ISO 8601 timestamp
    requestId: string;      // Unique request identifier for tracking
  };
}
```

### Error Handling Strategies

1. **Graceful Degradation**
   - If maps API fails, use cached routes or fallback to manual entry
   - If push notifications fail, store for retry
   - If payment gateway is down, allow cash payment option

2. **Retry Logic**
   - Exponential backoff for transient failures
   - Maximum 3 retry attempts for external services
   - Circuit breaker pattern for failing services

3. **Transaction Rollback**
   - Database transactions for multi-step operations
   - Compensating transactions for distributed operations
   - Idempotency keys for payment operations

4. **Logging and Monitoring**
   - Log all errors with context (user ID, ride ID, stack trace)
   - Alert on critical errors (payment failures, database errors)
   - Track error rates and patterns

5. **User-Friendly Messages**
   - Translate technical errors to user-friendly language
   - Provide actionable guidance (e.g., "Check your internet connection")
   - Support multiple languages for error messages

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit testing and property-based testing to ensure comprehensive coverage:

- **Unit Tests**: Verify specific examples, edge cases, error conditions, and integration points
- **Property Tests**: Verify universal properties across all inputs through randomized testing

Both approaches are complementary and necessary. Unit tests catch concrete bugs and validate specific scenarios, while property tests verify general correctness across a wide input space.

### Unit Testing

**Framework**: Jest for backend (Node.js/Express), Jest + React Native Testing Library for mobile apps

**Focus Areas**:
- Specific examples demonstrating correct behavior
- Edge cases (empty inputs, boundary values, null/undefined)
- Error conditions and exception handling
- Integration between components
- API endpoint contracts
- Database queries and transactions
- Authentication and authorization flows

**Coverage Goals**:
- Minimum 80% code coverage
- 100% coverage for critical paths (authentication, payments, ride matching)
- All error handlers must have tests

**Example Unit Tests**:
```typescript
describe('Fare Calculation', () => {
  it('should calculate fare for a 10km, 20min taxi ride', () => {
    const fare = calculateFare(10, 20, 'taxi');
    expect(fare).toBe(expectedValue);
  });

  it('should handle zero distance', () => {
    const fare = calculateFare(0, 5, 'taxi');
    expect(fare).toBeGreaterThanOrEqual(baseFare);
  });

  it('should throw error for negative distance', () => {
    expect(() => calculateFare(-5, 10, 'taxi')).toThrow();
  });
});
```

### Property-Based Testing

**Framework**: fast-check for JavaScript/TypeScript

**Configuration**:
- Minimum 100 iterations per property test (due to randomization)
- Seed-based reproducibility for failed tests
- Shrinking enabled to find minimal failing cases

**Tagging Convention**:
Each property test must include a comment tag referencing the design document property:

```typescript
/**
 * Feature: taxi-platform, Property 12: Fare Calculation Includes All Components
 */
test('fare calculation includes all components', () => {
  fc.assert(
    fc.property(
      fc.float({ min: 0, max: 100 }),  // distance
      fc.integer({ min: 0, max: 120 }), // duration
      fc.constantFrom('taxi', 'moto-taxi'),
      (distance, duration, vehicleType) => {
        const fare = calculateFare(distance, duration, vehicleType);
        const config = getFareConfig(vehicleType);
        const expected = config.baseFare + 
                        (distance * config.perKmRate) + 
                        (duration * config.perMinuteRate);
        expect(fare).toBeCloseTo(expected, 2);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test Categories**:

1. **Round-trip Properties**
   - Serialization/deserialization of data models
   - Encoding/decoding of tokens
   - Database write/read operations

2. **Invariant Properties**
   - Ride state machine constraints
   - Balance calculations (earnings = fare - commission)
   - Rating bounds (1-5)
   - Geospatial constraints (distance calculations)

3. **Idempotence Properties**
   - Multiple identical requests produce same result
   - Availability toggle operations
   - Configuration updates

4. **Metamorphic Properties**
   - Adding more documents doesn't remove existing ones
   - Filtering results is subset of unfiltered results
   - Cancellation doesn't create new rides

5. **Error Condition Properties**
   - Invalid inputs always produce errors
   - Unauthorized actions always rejected
   - Constraint violations always caught

### Integration Testing

**Focus**: Test interactions between services and external dependencies

**Tools**: Supertest for API testing, Testcontainers for database

**Test Scenarios**:
- Complete ride lifecycle (request → accept → complete → payment)
- User registration and verification flow
- Real-time location updates via WebSocket
- Payment processing with mock payment gateway
- Push notification delivery

### End-to-End Testing

**Framework**: Detox for React Native apps, Playwright for web dashboard

**Critical User Journeys**:
1. Passenger requests ride → Driver accepts → Ride completes → Payment processed
2. Driver registers → Uploads documents → Admin verifies → Driver goes online
3. Admin configures fares → New fares applied to subsequent rides
4. User cancels ride → Cancellation fee applied (if applicable)

### Performance Testing

**Tools**: Artillery or k6 for load testing

**Scenarios**:
- 1000 concurrent ride requests
- 10,000 location updates per second
- Database query performance under load
- WebSocket connection scalability

### Security Testing

**Focus Areas**:
- SQL injection prevention
- XSS prevention in user inputs
- JWT token validation
- Rate limiting effectiveness
- Password hashing verification
- HTTPS enforcement
- PCI-DSS compliance for payment data

### Testing Environment

**Development**: Local PostgreSQL + Redis, mock external services
**Staging**: Cloud-hosted database, real external services with test credentials
**Production**: Monitoring and alerting, canary deployments

### Continuous Integration

**Pipeline**:
1. Lint and format check
2. Unit tests (parallel execution)
3. Property tests (parallel execution)
4. Integration tests
5. Build mobile apps (EAS Build)
6. E2E tests on staging
7. Deploy to production (manual approval)

**Quality Gates**:
- All tests must pass
- Code coverage ≥ 80%
- No critical security vulnerabilities
- Performance benchmarks met

## Security Considerations

### Authentication & Authorization

- JWT tokens with 24-hour expiration
- Refresh token rotation for extended sessions
- Role-based access control (passenger, driver, admin)
- Multi-factor authentication for admin accounts (recommended)

### Data Protection

- All passwords hashed with bcrypt (cost factor 12)
- Payment card data tokenized via payment gateway
- PII encrypted at rest in database
- HTTPS/TLS 1.3 for all communications
- Secure WebSocket connections (WSS)

### API Security

- Rate limiting per IP and per user
- CORS configuration for web clients
- Input validation and sanitization
- SQL injection prevention via parameterized queries
- XSS prevention via output encoding

### Mobile App Security

- Certificate pinning for API calls
- Secure storage for tokens (Keychain/Keystore)
- Biometric authentication option
- Code obfuscation for production builds
- Jailbreak/root detection

### Compliance

- GDPR compliance for user data
- Right to deletion (account removal)
- Data portability (export user data)
- Privacy policy and terms of service
- PCI-DSS compliance for payment processing

## Scalability Considerations

### Horizontal Scaling

- Stateless backend services for easy scaling
- Load balancer for distributing traffic
- Redis for session management and caching
- Database read replicas for query scaling

### Caching Strategy

- Redis cache for:
  - Active ride data
  - Driver locations (TTL: 30 seconds)
  - Fare configurations
  - User sessions
- CDN for static assets

### Database Optimization

- Indexes on frequently queried fields
- PostGIS spatial indexes for geolocation queries
- Connection pooling
- Query optimization and monitoring
- Partitioning for large tables (rides, payments)

### Real-time Communication

- Socket.io with Redis adapter for multi-server support
- Room-based messaging for ride-specific updates
- Heartbeat mechanism for connection health
- Automatic reconnection on client side

### Monitoring & Observability

- Application metrics (request rate, latency, errors)
- Business metrics (rides per hour, revenue, active users)
- Infrastructure metrics (CPU, memory, disk, network)
- Distributed tracing for request flows
- Log aggregation and analysis

### Cost Optimization

- Auto-scaling based on demand
- Spot instances for non-critical workloads
- Database query optimization to reduce load
- CDN for reducing bandwidth costs
- Efficient image storage and compression

## Deployment Architecture

### Production Environment

```
┌─────────────────────────────────────────────────────────┐
│                     CloudFlare CDN                       │
│                  (Static Assets, DDoS)                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Load Balancer (AWS ALB)                 │
└────────┬───────────────────────────┬────────────────────┘
         │                           │
┌────────▼────────┐         ┌────────▼────────┐
│  API Server 1   │         │  API Server 2   │
│  (Express)      │   ...   │  (Express)      │
│  Docker/ECS     │         │  Docker/ECS     │
└────────┬────────┘         └────────┬────────┘
         │                           │
         └───────────┬───────────────┘
                     │
         ┌───────────┼───────────────┐
         │           │               │
┌────────▼────┐ ┌───▼────┐ ┌────────▼────────┐
│ PostgreSQL  │ │ Redis  │ │  S3 / Storage   │
│  (RDS)      │ │(ElastiCache)│ (Documents)  │
└─────────────┘ └────────┘ └─────────────────┘
```

### Mobile App Deployment

**Android**:
1. Build with EAS Build: `eas build --platform android --profile production`
2. Generate signed AAB (Android App Bundle)
3. Upload to Google Play Console
4. Staged rollout (10% → 50% → 100%)
5. Monitor crash reports and ratings

**iOS**:
1. Build with EAS Build: `eas build --platform ios --profile production`
2. Generate signed IPA with App Store provisioning
3. Upload to App Store Connect via EAS Submit
4. TestFlight beta testing
5. Submit for App Store review
6. Phased release

**Web**:
1. Build: `npx expo export --platform web`
2. Deploy to Vercel/Netlify
3. Configure custom domain
4. Enable PWA features
5. Set up analytics and monitoring

### Environment Configuration

**Development**:
- Local database and Redis
- Mock payment gateway
- Development API keys
- Hot reload enabled

**Staging**:
- Cloud-hosted database (smaller instance)
- Test payment gateway credentials
- Staging API keys
- Production-like configuration

**Production**:
- High-availability database with replicas
- Production payment gateway
- Production API keys
- Auto-scaling enabled
- Monitoring and alerting active

### CI/CD Pipeline

**GitHub Actions Workflow**:
```yaml
1. Code push to main branch
2. Run linters and formatters
3. Run unit tests
4. Run property tests
5. Run integration tests
6. Build Docker images
7. Push to container registry
8. Deploy to staging
9. Run E2E tests on staging
10. Manual approval gate
11. Deploy to production (blue-green)
12. Health checks
13. Rollback on failure
```

### Backup & Disaster Recovery

- Automated daily database backups (retained 30 days)
- Point-in-time recovery enabled
- Cross-region backup replication
- Disaster recovery plan with RTO < 4 hours
- Regular restore testing

### Monitoring & Alerting

**Metrics to Monitor**:
- API response times (p50, p95, p99)
- Error rates by endpoint
- Active rides count
- WebSocket connections
- Database query performance
- Payment success rate
- App crash rate

**Alerts**:
- Error rate > 5%
- API latency > 2 seconds
- Database CPU > 80%
- Payment failures > 10%
- WebSocket disconnections spike

## Conclusion

This design document provides a comprehensive technical blueprint for the taxi and moto-taxi platform. The architecture leverages modern technologies (Expo, React Native, Express, PostgreSQL) to deliver a scalable, secure, and maintainable solution that can be deployed across Android, iOS, and Web platforms from a single codebase.

The system is designed with correctness at its core, with 57 formally specified properties that will be validated through property-based testing. Combined with comprehensive unit and integration tests, this approach ensures high reliability and correctness.

Key architectural decisions include:
- Expo for cross-platform mobile development with native capabilities
- Express backend for flexibility and ecosystem maturity
- PostgreSQL with PostGIS for robust geospatial queries
- Redis for real-time features and caching
- Socket.io for bidirectional real-time communication
- Property-based testing for correctness guarantees

The deployment strategy supports all three platforms (Android, iOS, Web) with streamlined CI/CD pipelines using EAS Build and modern hosting platforms. Security, scalability, and monitoring are built into the architecture from the ground up, ensuring the platform can grow from initial launch to serving thousands of concurrent users.
