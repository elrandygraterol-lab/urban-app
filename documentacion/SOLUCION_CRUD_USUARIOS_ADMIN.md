# Solución CRUD de Usuarios - Panel Admin

## Problemas Identificados y Solucionados

### 1. Usuarios no se listaban después de crearlos
**Problema**: Al crear un usuario conductor, no aparecía en la lista.
**Causa**: El método `createUser` no creaba el perfil de conductor (`DriverProfile`) ni el perfil de pasajero (`PassengerProfile`) asociado.

**Solución**:
- Actualizado `adminService.createUser()` para crear automáticamente:
  - `DriverProfile` cuando role='driver' con datos de vehículo
  - `PassengerProfile` cuando role='passenger'
- Agregada validación de campos de vehículo obligatorios para conductores

### 2. Inconsistencia en campo de teléfono
**Problema**: La vista usaba `user.phone || user.phoneNumber` pero el campo en BD es `phone`.
**Solución**: 
- Actualizada la vista para usar solo `user.phone`
- Mantenida compatibilidad en respuestas de API con ambos campos

### 3. Falta botón para ver documentos de conductores
**Problema**: No había forma de ver los documentos subidos por conductores.
**Solución**:
- Agregado botón "Ver Documentos" en la tabla para conductores
- Creado modal para visualizar documentos
- Implementado endpoint `/api/admin/users/:userId/documents`
- Agregado método `getDriverDocuments()` en adminService

### 4. Faltan campos para información de vehículo
**Problema**: No se podían ingresar datos de vehículo al crear/editar conductores.
**Solución**:
- Agregados campos en el formulario:
  - Tipo de Vehículo (taxi/moto-taxi) *
  - Placa del Vehículo *
  - Modelo del Vehículo *
  - Color del Vehículo
  - Año del Vehículo
- Campos se muestran/ocultan dinámicamente según el rol seleccionado
- Campos marcados con * son obligatorios para conductores

## Archivos Modificados

### Backend

#### 1. `backend/src/services/adminService.ts`
- **Método `createUser()`**: 
  - Agregados parámetros opcionales de vehículo
  - Validación de campos de vehículo para conductores
  - Creación automática de `DriverProfile` con datos de vehículo
  - Creación automática de `PassengerProfile` para pasajeros

- **Método `updateUser()`**:
  - Agregados parámetros opcionales de vehículo
  - Actualización de `DriverProfile` si el usuario es conductor

- **Nuevo método `getDriverDocuments()`**:
  - Obtiene documentos de verificación de un conductor
  - Retorna información del conductor y estado de verificación

#### 2. `backend/src/controllers/adminController.ts`
- **Método `createUser()`**: 
  - Recibe y procesa datos de vehículo del request
  - Pasa datos de vehículo al servicio

- **Método `updateUser()`**:
  - Recibe y procesa datos de vehículo del request
  - Pasa datos de vehículo al servicio

- **Nuevo método `getDriverDocuments()`**:
  - Maneja peticiones GET para obtener documentos de conductor

#### 3. `backend/src/routes/adminRoutes.ts`
- Agregada ruta: `GET /api/admin/users/:userId/documents`

### Frontend

#### 4. `backend/views/admin/users-list.ejs`
- **Sección HTML**:
  - Agregado modal para visualizar documentos
  - Agregados campos de vehículo en formulario de usuario
  - Campos de vehículo ocultos por defecto, se muestran al seleccionar rol "Conductor"

- **Sección JavaScript**:
  - Función `toggleDriverFields()`: Muestra/oculta campos de vehículo según rol
  - Función `viewDocuments()`: Carga y muestra documentos del conductor
  - Función `getDocumentTypeLabel()`: Traduce tipos de documentos
  - Función `closeDocumentsModal()`: Cierra modal de documentos
  - Actualizado `renderUsers()`: Usa solo `user.phone` (sin fallback a phoneNumber)
  - Actualizado form submission: Incluye datos de vehículo si rol es conductor
  - Agregado event listener para cambio de rol

## Flujo de Creación de Usuario Conductor

1. Admin hace clic en "Nuevo Usuario"
2. Completa campos básicos (nombre, email, teléfono, contraseña)
3. Selecciona rol "Conductor"
4. Aparecen automáticamente campos de vehículo
5. Completa campos de vehículo (tipo, placa, modelo son obligatorios)
6. Al guardar:
   - Se crea el usuario en tabla `User`
   - Se crea automáticamente el perfil en tabla `DriverProfile`
   - Estado de verificación inicial: 'pending'
   - isAvailable: false
7. Usuario aparece inmediatamente en la lista

## Flujo de Visualización de Documentos

1. Admin ve lista de usuarios
2. Para conductores, aparece botón verde "Ver Documentos"
3. Al hacer clic:
   - Se hace petición a `/api/admin/users/:userId/documents`
   - Se abre modal con documentos del conductor
   - Muestra estado de verificación del conductor
   - Lista cada documento con:
     - Tipo de documento
     - Fecha de subida
     - Estado de verificación
     - Enlace para ver el documento
4. Si no hay documentos, muestra mensaje informativo

## Validaciones Implementadas

### Creación de Usuario
- Todos los campos básicos son obligatorios
- Contraseña mínimo 6 caracteres
- Email único en el sistema
- Teléfono único en el sistema
- Si rol es "conductor":
  - Tipo de vehículo obligatorio
  - Placa obligatoria
  - Modelo obligatorio

### Actualización de Usuario
- Email único (si se cambia)
- Teléfono único (si se cambia)
- Contraseña opcional (solo si se proporciona)
- Datos de vehículo opcionales para conductores existentes

## Tipos de Documentos Soportados

- `drivers_license`: Licencia de Conducir
- `vehicle_registration`: Registro del Vehículo
- `insurance`: Seguro
- `medical_certificate`: Certificado Médico
- `background_check`: Antecedentes
- `profile_photo`: Foto de Perfil

## Estados de Verificación

- `pending`: Pendiente de verificación
- `verified`: Verificado
- `rejected`: Rechazado

## Notas Importantes

1. Los documentos deben ser subidos por el conductor desde la app móvil
2. El admin puede ver los documentos pero no subirlos desde el panel
3. Los documentos se pueden gestionar en la sección de "Verificaciones"
4. Al crear un conductor, se crea con estado 'pending' y no disponible
5. El conductor debe ser verificado antes de poder aceptar viajes

## Pruebas Recomendadas

1. Crear usuario pasajero y verificar que aparece en lista
2. Crear usuario conductor con datos de vehículo y verificar que aparece en lista
3. Intentar crear conductor sin datos de vehículo (debe fallar)
4. Editar usuario conductor y actualizar datos de vehículo
5. Ver documentos de conductor (si tiene documentos subidos)
6. Verificar que emails y teléfonos duplicados son rechazados
