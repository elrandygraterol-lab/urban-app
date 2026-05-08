# Guía Completa de Cloudinary para UrbanTaxi

## Tabla de Contenidos
1. [Introducción](#introducción)
2. [Configuración Inicial](#configuración-inicial)
3. [Integración Backend](#integración-backend)
4. [Integración Frontend](#integración-frontend)
5. [Flujo Completo](#flujo-completo)
6. [Troubleshooting](#troubleshooting)

---

## Introducción

Cloudinary es un servicio en la nube para gestión de imágenes con:
- Almacenamiento ilimitado
- CDN global
- Optimización automática
- Transformaciones de imágenes
- Backups automáticos

### Credenciales UrbanTaxi
```
Cloud Name: dchkq5aa9
API Key: 156523171374746
API Secret: H2spA1vFXXqEmju3Ly4PoWhqGWk
```

---

## Configuración Inicial

### 1. Crear Cuenta
1. Ir a https://cloudinary.com
2. Registrarse (gratis)
3. Verificar email
4. Acceder al dashboard

### 2. Obtener Credenciales
1. Dashboard → Settings → Account
2. Copiar:
   - Cloud Name
   - API Key
   - API Secret

### 3. Crear Upload Preset
1. Settings → Upload
2. Add upload preset
3. Configurar:
   - **Name**: `urbantaxi_documents`
   - **Unsigned**: ON
   - **Folder**: `urbantaxi/drivers`
4. Guardar

---

## Integración Backend

### 1. Instalar Dependencias
```bash
npm install cloudinary multer-storage-cloudinary
```

### 2. Configurar Variables de Entorno
```env
CLOUDINARY_CLOUD_NAME=dchkq5aa9
CLOUDINARY_API_KEY=156523171374746
CLOUDINARY_API_SECRET=H2spA1vFXXqEmju3Ly4PoWhqGWk
```

### 3. Crear Middleware
```typescript
// src/middleware/cloudinaryUpload.ts
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req: any, file: Express.Multer.File) => {
    const driverId = req.params.driverId;
    const documentType = req.body.documentType;

    return {
      folder: `urbantaxi/drivers/${driverId}`,
      public_id: `${documentType}_${Date.now()}`,
      resource_type: 'auto',
      quality: 'auto',
      fetch_format: 'auto',
    };
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
```

### 4. Usar en Rutas
```typescript
// routes/drivers.ts
import { upload } from '@/middleware/cloudinaryUpload';

router.post('/drivers/:driverId/documents', upload.single('file'), async (req, res) => {
  const fileUrl = (req.file as any).path;
  
  // Guardar URL en base de datos
  await Document.create({
    driverId: req.params.driverId,
    type: req.body.documentType,
    url: fileUrl,
    cloudinaryPublicId: (req.file as any).public_id,
  });
  
  res.json({ success: true, url: fileUrl });
});
```

---

## Integración Frontend

### 1. Instalar Dependencia
```bash
npm install cloudinary-react-native --legacy-peer-deps
```

### 2. Crear Servicio
```typescript
// services/cloudinary.ts
const CLOUDINARY_CLOUD_NAME = 'dchkq5aa9';
const CLOUDINARY_UPLOAD_PRESET = 'urbantaxi_documents';

export const uploadDocumentToCloudinary = async (
  uri: string,
  documentType: string,
  driverId: string
) => {
  const formData = new FormData();
  
  const response = await fetch(uri);
  const blob = await response.blob();
  
  formData.append('file', blob, `${documentType}_${Date.now()}.jpg`);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', `urbantaxi/drivers/${driverId}`);
  formData.append('public_id', `${documentType}_${Date.now()}`);
  
  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );
  
  return await uploadResponse.json();
};
```

### 3. Usar en Pantalla
```typescript
// app/(driver)/documents-upload.tsx
import { uploadDocumentToCloudinary } from '@/services/cloudinary';
import * as ImagePicker from 'expo-image-picker';

export default function DocumentsUploadScreen() {
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    
    if (!result.canceled) {
      const cloudinaryResponse = await uploadDocumentToCloudinary(
        result.assets[0].uri,
        'drivers_license',
        user.id
      );
      
      console.log('Uploaded to:', cloudinaryResponse.secure_url);
    }
  };
  
  return (
    <TouchableOpacity onPress={pickImage}>
      <Text>Seleccionar Imagen</Text>
    </TouchableOpacity>
  );
}
```

---

## Flujo Completo

### 1. Usuario Selecciona Imagen
```
App → ImagePicker → URI local
```

### 2. Upload a Cloudinary
```
App → Cloudinary API → Almacenamiento en nube
```

### 3. Obtener URL
```
Cloudinary → URL segura → App
```

### 4. Enviar al Backend
```
App → Backend API → Base de datos
```

### 5. Verificación por Admin
```
Admin → Dashboard → Revisar documentos → Aprobar/Rechazar
```

---

## Troubleshooting

### Error: "Upload preset not found"
**Solución**:
1. Verificar que el preset esté creado en Cloudinary
2. Verificar que el nombre sea exacto: `urbantaxi_documents`
3. Verificar que esté activado (ON)

### Error: "Unsigned uploads not allowed"
**Solución**:
1. Editar el preset
2. Activar toggle "Unsigned"
3. Guardar

### Error: "File too large"
**Solución**:
1. Verificar que el archivo sea < 5MB
2. Comprimir imagen antes de subir
3. Aumentar límite en middleware si es necesario

### Imágenes no aparecen en Cloudinary
**Solución**:
1. Verificar que el upload fue exitoso (status 200)
2. Revisar carpeta `urbantaxi/drivers` en Media Library
3. Verificar que la URL sea correcta

---

## Monitoreo

### Dashboard de Cloudinary
1. Ir a https://cloudinary.com/console
2. Ver:
   - **Media Library**: Archivos subidos
   - **Usage**: Almacenamiento y ancho de banda
   - **Transformations**: Optimizaciones aplicadas

### Métricas Importantes
- **Almacenamiento usado**: vs 25 GB (tier gratuito)
- **Ancho de banda**: vs 25 GB/mes
- **Número de archivos**: Total de documentos
- **Transformaciones**: Optimizaciones aplicadas

---

## Mejores Prácticas

### 1. Validación
```typescript
// Validar antes de subir
if (file.size > 5 * 1024 * 1024) {
  throw new Error('Archivo muy grande');
}

if (!['image/jpeg', 'image/png'].includes(file.type)) {
  throw new Error('Formato no permitido');
}
```

### 2. Manejo de Errores
```typescript
try {
  const result = await uploadDocumentToCloudinary(...);
  return result;
} catch (error) {
  console.error('Upload failed:', error);
  Alert.alert('Error', 'No se pudo subir el documento');
}
```

### 3. Optimización
```typescript
// Usar URLs optimizadas
const optimizedUrl = `${baseUrl}/w_400,h_300,c_fill,q_auto,f_auto/${publicId}`;
```

### 4. Seguridad
```typescript
// Nunca exponer API secret en frontend
// Usar upload presets sin firmar
// Validar en backend
```

---

## Conclusión

Cloudinary proporciona:
✅ Almacenamiento confiable
✅ CDN global
✅ Optimización automática
✅ Backups automáticos
✅ Escalabilidad garantizada

---

**Documento generado**: 15 de Marzo de 2026
**Versión**: 1.0
