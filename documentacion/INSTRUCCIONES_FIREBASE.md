# 🔥 Instrucciones Inmediatas para Configurar Firebase

## ✅ Lo que ya hicimos

1. ✅ Configuramos el nombre del paquete en `app/app.json`:
   - Android: `com.urbantaxi.passenger`
   - iOS: `com.urbantaxi.passenger`

## 📝 Lo que DEBES hacer AHORA en Firebase Console

### Paso 1: Registrar la App Android

En la pantalla que tienes abierta en Firebase:

1. **Nombre del paquete de Android**: Ingresa exactamente esto:
   ```
   com.urbantaxi.passenger
   ```

2. **Sobrenombre de la app (opcional)**: Ingresa:
   ```
   UrbanTaxi Passenger App
   ```

3. Haz clic en **"Registrar app"**

### Paso 2: Descargar google-services.json

1. Firebase te mostrará un botón para descargar `google-services.json`
2. Descarga ese archivo
3. Muévelo a la carpeta de tu proyecto: `app/google-services.json`
   - La ruta completa debe ser: `taxi-platform/app/google-services.json`

### Paso 3: Continuar en Firebase Console

1. Haz clic en **"Siguiente"** (puedes omitir los pasos de agregar SDK por ahora)
2. Haz clic en **"Siguiente"** nuevamente
3. Haz clic en **"Continuar a la consola"**

### Paso 4: Obtener Credenciales para el Backend

Ahora necesitas las credenciales para que el backend pueda enviar notificaciones:

1. En Firebase Console, haz clic en el ícono de **engranaje ⚙️** (arriba a la izquierda)
2. Selecciona **"Configuración del proyecto"**
3. Ve a la pestaña **"Cuentas de servicio"**
4. Haz clic en el botón **"Generar nueva clave privada"**
5. Confirma haciendo clic en **"Generar clave"**
6. Se descargará un archivo JSON (algo como `urbantaxi-xxxxx-firebase-adminsdk-xxxxx.json`)

### Paso 5: Guardar las Credenciales del Backend

1. Crea la carpeta `backend/config` si no existe
2. Renombra el archivo descargado a: `firebase-service-account.json`
3. Muévelo a: `backend/config/firebase-service-account.json`

**⚠️ IMPORTANTE**: Este archivo contiene credenciales sensibles. NO lo subas a Git.

## 🔐 Seguridad

Voy a actualizar el `.gitignore` para asegurar que no subas archivos sensibles.

## 📋 Checklist

Marca cuando completes cada paso:

- [ ] Registré la app en Firebase con el package `com.urbantaxi.passenger`
- [ ] Descargué `google-services.json`
- [ ] Coloqué `google-services.json` en `app/google-services.json`
- [ ] Descargué las credenciales de servicio (archivo JSON de Admin SDK)
- [ ] Creé la carpeta `backend/config`
- [ ] Renombré el archivo a `firebase-service-account.json`
- [ ] Coloqué el archivo en `backend/config/firebase-service-account.json`

## ✨ Siguiente Paso

Una vez que completes estos pasos, avísame y continuaremos con:
- Instalar las dependencias necesarias
- Implementar el servicio de notificaciones en el backend
- Configurar el registro de tokens en la app
- Probar el envío de notificaciones

## 🆘 ¿Necesitas Ayuda?

Si tienes alguna duda en cualquier paso, pregúntame y te ayudaré a resolverla.
