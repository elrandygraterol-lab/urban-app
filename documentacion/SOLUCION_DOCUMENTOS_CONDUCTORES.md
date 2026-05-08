# Solución: Documentos del Conductor

## Problema Identificado

Al crear un conductor y subir la licencia de conducir y el certificado médico, al hacer clic en el ícono de "Ver documentos" solo se mostraba uno de los documentos. El problema tenía dos causas principales:

### 1. Tipo de Documento Faltante en el Schema

El enum `DocumentType` en el schema de Prisma no incluía el tipo `medical_certificate`, solo tenía:
- `drivers_license`
- `vehicle_registration`
- `insurance`
- `vehicle_photo_front`
- `vehicle_photo_back`
- `vehicle_photo_side`

### 2. Documentos No Se Guardaban en el Registro

Cuando un conductor se registraba desde la app móvil, los documentos (licencia y certificado médico) se enviaban en el request pero NO se estaban guardando en la base de datos. El endpoint de registro solo creaba el usuario y el perfil del conductor, pero no procesaba los archivos adjuntos.

## Solución Implementada

### 1. Actualización del Schema de Prisma

Se agregó el tipo `medical_certificate` al enum `DocumentType`:

```prisma
enum DocumentType {
  drivers_license
  medical_certificate  // ← NUEVO
  vehicle_registration
  insurance
  vehicle_photo_front
  vehicle_photo_back
  vehicle_photo_side
}
```

Se creó y aplicó la migración:
```bash
npx prisma migrate dev --name add_medical_certificate_document_type
```

### 2. Actualización de la Ruta de Registro

Se configuró multer en la ruta de registro de conductor para aceptar archivos:

**Archivo:** `backend/src/routes/authRoutes.ts`

```typescript
import multer from 'multer';

// Configurar multer para registro de conductor
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  },
});

router.post(
  '/register/driver',
  driverRegisterLimiter,
  upload.fields([
    { name: 'driverLicense', maxCount: 1 },
    { name: 'medicalCertificate', maxCount: 1 },
  ]),
  authController.registerDriver.bind(authController)
);
```

### 3. Actualización del Controlador

Se modificó el controlador para extraer los archivos del request y pasarlos al servicio:

**Archivo:** `backend/src/controllers/authController.ts`

```typescript
async registerDriver(req: Request, res: Response, next: NextFunction) {
  try {
    const validatedData = registerDriverSchema.parse(req.body);

    // Obtener archivos subidos
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const driverLicense = files?.driverLicense?.[0];
    const medicalCertificate = files?.medicalCertificate?.[0];

    // Registrar conductor con documentos
    const result = await authService.registerDriver(
      validatedData,
      driverLicense,
      medicalCertificate
    );

    // ... resto del código
  }
}
```

### 4. Actualización del Servicio de Autenticación

Se modificó el método `registerDriver` para guardar los documentos en el sistema de archivos y crear los registros en la base de datos:

**Archivo:** `backend/src/services/authService.ts`

```typescript
async registerDriver(
  data: RegisterDriverDto,
  driverLicense?: Express.Multer.File,
  medicalCertificate?: Express.Multer.File
): Promise<AuthResponseDto> {
  // ... crear usuario y perfil ...

  // Guardar documentos si fueron proporcionados
  if (user.driverProfile && (driverLicense || medicalCertificate)) {
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(process.cwd(), 'uploads', 'documents');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Guardar licencia de conducir
    if (driverLicense) {
      const filename = `${Date.now()}-${driverLicense.originalname}`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, driverLicense.buffer);
      const documentUrl = `/uploads/documents/${filename}`;

      await prisma.verificationDocument.create({
        data: {
          driverId: user.driverProfile.id,
          documentType: 'drivers_license',
          documentUrl,
          verificationStatus: 'pending',
          uploadDate: new Date(),
        },
      });
    }

    // Guardar certificado médico
    if (medicalCertificate) {
      const filename = `${Date.now()}-${medicalCertificate.originalname}`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, medicalCertificate.buffer);
      const documentUrl = `/uploads/documents/${filename}`;

      await prisma.verificationDocument.create({
        data: {
          driverId: user.driverProfile.id,
          documentType: 'medical_certificate',
          documentUrl,
          verificationStatus: 'pending',
          uploadDate: new Date(),
        },
      });
    }
  }

  // ... generar tokens y retornar ...
}
```

## Resultado

Ahora cuando un conductor se registra desde la app móvil:

1. ✅ Los documentos (licencia de conducir y certificado médico) se guardan correctamente en el servidor
2. ✅ Se crean los registros correspondientes en la tabla `verification_documents`
3. ✅ Al hacer clic en "Ver documentos" en el panel de admin, se muestran TODOS los documentos subidos
4. ✅ Cada documento muestra su tipo, fecha de subida, estado de verificación y un enlace para verlo

## Verificación

Para verificar que la solución funciona:

1. Registrar un nuevo conductor desde la app móvil
2. Subir la licencia de conducir y el certificado médico
3. Ir al panel de administración
4. Buscar el conductor recién registrado
5. Hacer clic en el ícono de "Ver documentos"
6. Verificar que aparecen ambos documentos: "Licencia de Conducir" y "Certificado Médico"
