# Aclaración: Subida de Documentos de Conductores

## IMPORTANTE: Los documentos NO se suben desde el panel admin

Los documentos de los conductores (licencia de conducir, certificado médico, registro del vehículo, etc.) **NO se suben desde el panel de administración**.

## Flujo Correcto de Documentos

### 1. Creación del Conductor desde Panel Admin
- El admin crea el usuario conductor con:
  - Datos personales (nombre, email, teléfono, contraseña)
  - Datos del vehículo (tipo, placa, modelo, color, año)
- El conductor se crea con estado `verificationStatus: 'pending'`
- El conductor NO puede aceptar viajes hasta ser verificado

### 2. Subida de Documentos desde App Móvil
- El conductor descarga la app móvil
- Inicia sesión con sus credenciales
- Desde su perfil, sube los documentos requeridos:
  - Licencia de conducir
  - Certificado médico
  - Registro del vehículo (opcional)
  - Seguro (opcional)
  - Foto de perfil

### 3. Verificación desde Panel Admin
- El admin va a la sección "Verificaciones" en el panel
- Ve la lista de conductores pendientes de verificación
- Hace clic en "Ver Documentos" para revisar los documentos subidos
- Puede:
  - **Aprobar**: El conductor queda verificado y puede aceptar viajes
  - **Rechazar**: El conductor recibe notificación con la razón del rechazo

### 4. Visualización de Documentos desde Gestión de Usuarios
- En la sección "Usuarios", los conductores tienen un botón verde "Ver Documentos"
- Al hacer clic, se abre un modal mostrando:
  - Estado de verificación del conductor
  - Lista de documentos subidos
  - Estado de cada documento (verificado/pendiente/rechazado)
  - Enlace para ver cada documento

## ¿Por Qué No Se Suben Documentos desde el Panel Admin?

1. **Seguridad**: Los documentos contienen información sensible que debe ser manejada directamente por el conductor
2. **Autenticidad**: El conductor debe ser quien suba sus propios documentos para garantizar su autenticidad
3. **Responsabilidad**: El conductor es responsable de mantener sus documentos actualizados
4. **Flujo de Trabajo**: El proceso de verificación requiere que el conductor tenga acceso a la app móvil

## Endpoints Relacionados

### Para la App Móvil (Conductor)
- `POST /api/driver/documents/upload` - Subir documento
- `GET /api/driver/documents` - Ver mis documentos
- `DELETE /api/driver/documents/:documentId` - Eliminar documento

### Para el Panel Admin
- `GET /api/admin/drivers/pending-verification` - Conductores pendientes
- `GET /api/admin/users/:userId/documents` - Ver documentos de un conductor
- `PUT /api/admin/drivers/:driverId/verify` - Verificar o rechazar conductor

## Solución Implementada

### Lo que SÍ se puede hacer desde el panel admin:
✅ Crear usuario conductor con datos de vehículo
✅ Ver documentos subidos por el conductor
✅ Verificar o rechazar documentos
✅ Editar datos del conductor (nombre, email, teléfono, vehículo)
✅ Suspender/reactivar conductor
✅ Eliminar conductor

### Lo que NO se puede hacer desde el panel admin:
❌ Subir documentos por el conductor
❌ Editar documentos subidos
❌ Eliminar documentos individuales (solo el conductor puede)

## Mensaje en el Formulario

En el formulario de creación/edición de conductores, se muestra este mensaje:

> **Nota:** Los documentos del conductor (licencia, registro del vehículo, etc.) deben ser subidos por el conductor desde la aplicación móvil o pueden ser gestionados en la sección de Verificaciones.

Este mensaje aclara al administrador que los documentos no se suben en este formulario.
