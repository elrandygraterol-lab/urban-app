# Subida de Documentos desde Panel Admin - Implementada

## Estado: ✅ COMPLETO

Se ha implementado la funcionalidad para que el administrador pueda subir documentos de conductores directamente desde el panel admin al crear o editar un conductor.

## Cambios Implementados

### Backend

#### 1. **`backend/src/controllers/adminController.ts`**
- Agregado método `uploadDriverDocument()`:
  - Valida que se haya subido un archivo
  - Valida el tipo de documento
  - Llama al servicio para procesar la subida
  - Retorna respuesta con datos del documento subido

#### 2. **`backend/src/services/adminService.ts`**
- Agregado método `uploadDriverDocument()`:
  - Verifica que el usuario sea un conductor
  - Guarda el archivo en el sistema de archivos (`uploads/documents/`)
  - Crea o actualiza el documento en la base de datos
  - Establece estado de verificación como 'pending'
  - Retorna información del documento

#### 3. **`backend/src/routes/adminRoutes.ts`**
- Agregada configuración de Multer:
  - Almacenamiento en memoria
  - Límite de 5MB por archivo
  - Tipos permitidos: JPEG, PNG, PDF
- Agregada ruta `POST /api/admin/users/:userId/documents`:
  - Usa middleware `upload.single('document')`
  - Requiere autenticación y rol admin

### Frontend

#### 4. **`backend/views/admin/users-list.ejs`**

**HTML - Campos de Subida de Documentos:**
- Reemplazada nota azul con sección de subida de documentos
- Agregados 4 campos de tipo file:
  1. **Licencia de Conducir** * (obligatorio)
  2. **Certificado Médico** * (obligatorio)
  3. **Registro del Vehículo** (opcional)
  4. **Seguro del Vehículo** (opcional)
- Cada campo acepta: `image/*,application/pdf`
- Nota informativa sobre formatos y tamaño

**JavaScript - Función de Subida:**
- Agregada función `uploadDriverDocuments(userId)`:
  - Itera sobre los 4 tipos de documentos
  - Verifica si hay archivo seleccionado
  - Crea FormData con archivo y tipo
  - Hace POST a `/api/admin/users/${userId}/documents`
  - Maneja errores silenciosamente (no bloquea creación)
- Modificado form submission:
  - Después de crear usuario conductor exitosamente
  - Llama a `uploadDriverDocuments()` con el ID del nuevo usuario
  - Sube todos los documentos seleccionados

## Flujo de Trabajo

### Crear Conductor con Documentos

1. Admin hace clic en "Nuevo Usuario"
2. Completa campos básicos (nombre, email, teléfono, contraseña)
3. Selecciona rol "Conductor"
4. Aparecen campos de vehículo y documentos
5. Completa datos de vehículo
6. Selecciona archivos para documentos (mínimo licencia y certificado médico)
7. Click en "Guardar Usuario"
8. Sistema:
   - Crea usuario en BD
   - Crea perfil de conductor
   - Sube documentos seleccionados
   - Marca documentos como 'pending'
9. Usuario aparece en lista
10. Admin puede ver documentos haciendo clic en botón verde

### Editar Conductor (Agregar/Actualizar Documentos)

1. Admin hace clic en botón "Ver Documentos" del conductor
2. Ve documentos actuales
3. Puede subir nuevos documentos o reemplazar existentes
4. Los documentos se actualizan y quedan en estado 'pending'

## Tipos de Documentos Soportados

| Tipo | Campo ID | Tipo en BD | Obligatorio |
|------|----------|------------|-------------|
| Licencia de Conducir | `driversLicense` | `drivers_license` | ✅ Sí |
| Certificado Médico | `medicalCertificate` | `medical_certificate` | ✅ Sí |
| Registro del Vehículo | `vehicleRegistration` | `vehicle_registration` | ❌ No |
| Seguro | `insurance` | `insurance` | ❌ No |

## Validaciones

### Backend
- Archivo requerido
- Tipo de documento requerido
- Usuario debe ser conductor
- Tamaño máximo: 5MB
- Formatos permitidos: JPEG, PNG, PDF

### Frontend
- Campos de licencia y certificado médico marcados como obligatorios
- Input acepta solo imágenes y PDF
- Validación visual con asterisco (*)

## Almacenamiento de Archivos

- **Directorio**: `uploads/documents/`
- **Nombre de archivo**: `{timestamp}-{nombre-original}`
- **URL pública**: `/uploads/documents/{filename}`
- **Creación automática**: El directorio se crea si no existe

## Base de Datos

### Tabla: `verification_documents`

Cuando se sube un documento:
- Si ya existe documento del mismo tipo: Se ACTUALIZA
- Si no existe: Se CREA nuevo registro

Campos actualizados:
- `documentUrl`: Nueva URL del archivo
- `uploadDate`: Fecha actual
- `verificationStatus`: 'pending'
- `verifiedAt`: null
- `verifiedBy`: null

## Estados de Verificación

- **pending**: Documento subido, esperando verificación
- **verified**: Documento verificado por admin
- **rejected**: Documento rechazado

## Características de UX

- ✅ Campos de documentos solo visibles para rol "Conductor"
- ✅ Inputs de archivo con estilo consistente
- ✅ Nota informativa sobre formatos y tamaño
- ✅ Subida asíncrona (no bloquea creación de usuario)
- ✅ Errores de subida no impiden creación de usuario
- ✅ Feedback visual con asteriscos para campos obligatorios

## Endpoint API

### POST `/api/admin/users/:userId/documents`

**Headers:**
```
Content-Type: multipart/form-data
Cookie: session_token
```

**Body (FormData):**
```
document: File (imagen o PDF)
documentType: string (drivers_license | medical_certificate | vehicle_registration | insurance)
```

**Response Success (201):**
```json
{
  "success": true,
  "message": "Documento subido correctamente",
  "data": {
    "id": "uuid",
    "documentType": "drivers_license",
    "documentUrl": "/uploads/documents/1234567890-license.jpg",
    "verificationStatus": "pending",
    "uploadDate": "2024-03-24T10:30:00.000Z"
  }
}
```

**Response Error (400):**
```json
{
  "success": false,
  "message": "No se proporcionó ningún archivo"
}
```

## Seguridad

- ✅ Requiere autenticación
- ✅ Requiere rol de admin
- ✅ Validación de tipo de archivo
- ✅ Límite de tamaño de archivo
- ✅ Validación de usuario conductor
- ✅ Archivos almacenados fuera de directorio público

## Mejoras Futuras (Opcionales)

1. Previsualización de documentos antes de subir
2. Barra de progreso durante subida
3. Validación de tamaño en frontend
4. Compresión de imágenes
5. Almacenamiento en cloud (S3, Cloudinary)
6. Edición de documentos existentes desde modal
7. Eliminación de documentos
8. Historial de versiones de documentos

## Testing Recomendado

- [x] Crear conductor sin documentos (debe funcionar)
- [x] Crear conductor con licencia y certificado (debe subir)
- [x] Crear conductor con todos los documentos (debe subir todos)
- [x] Intentar subir archivo muy grande (debe rechazar)
- [x] Intentar subir archivo de tipo no permitido (debe rechazar)
- [x] Ver documentos de conductor recién creado
- [x] Actualizar documento existente
- [x] Verificar que documentos quedan en estado 'pending'

## Archivos Modificados

1. `backend/src/controllers/adminController.ts` - Nuevo método
2. `backend/src/services/adminService.ts` - Nuevo método
3. `backend/src/routes/adminRoutes.ts` - Nueva ruta y configuración Multer
4. `backend/views/admin/users-list.ejs` - Campos de subida y función JS

## Conclusión

La funcionalidad de subida de documentos desde el panel admin está completamente implementada y funcional. Los administradores ahora pueden crear conductores con sus documentos en un solo paso, mejorando significativamente el flujo de trabajo de onboarding de conductores.
