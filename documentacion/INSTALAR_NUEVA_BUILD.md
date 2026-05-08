# 📱 Instalar Nueva Build - Registro Arreglado

## ✅ Build Completada Exitosamente

La nueva build de desarrollo está lista con todos los arreglos del registro.

**Build ID**: `44fd3d2a-d8f8-4ab4-a673-37b6afbfddfc`

## 📥 Cómo Instalar (2 opciones)

### Opción 1: Escanear QR Code 📷

El código QR apareció en tu terminal. Simplemente:
1. Abre la cámara de tu teléfono Android
2. Apunta al código QR en la pantalla
3. Toca la notificación que aparece
4. Descarga e instala el APK

### Opción 2: Link Directo 🔗

1. Abre este link en tu teléfono Android:
   ```
   https://expo.dev/accounts/randygraterol07/projects/app-taxis/builds/44fd3d2a-d8f8-4ab4-a673-37b6afbfddfc
   ```

2. Toca el botón "Download" o "Descargar"

3. Cuando termine la descarga, abre el archivo APK

4. Si Android te pide permiso para instalar desde fuentes desconocidas:
   - Toca "Configuración" o "Settings"
   - Activa "Permitir desde esta fuente"
   - Vuelve atrás e instala

## ⚠️ Importante Antes de Instalar

**Desinstala la app anterior primero** para evitar conflictos:
1. Mantén presionado el ícono de la app
2. Toca "Desinstalar" o arrastra a "Desinstalar"
3. Confirma

## 🧪 Probar el Registro

Después de instalar:

1. **Abre la app**

2. **Toca "Crear cuenta"**

3. **Llena el formulario**:
   - **Nombre**: Tu nombre completo
   - **Email**: tu@email.com
   - **Teléfono**: 4121234567 (solo números, sin +58)
   - **Contraseña**: mínimo 8 caracteres
   - **Confirmar contraseña**: la misma contraseña

4. **Toca "Registrarse"**

5. **Deberías ver**:
   - Un mensaje: "Registro exitoso - Tu cuenta ha sido creada correctamente"
   - La app te lleva automáticamente a la pantalla de login

6. **Inicia sesión** con el email y contraseña que acabas de crear

## ✅ Si Todo Funciona

Verás en la consola de Metro logs como estos:
```
[REGISTER] Starting registration...
[REGISTER] URL: http://192.168.1.200:3000/api/auth/register/passenger
[REGISTER] Response status: 201
[REGISTER] Success! Full result: {...}
[REGISTER] Using nested format
[REGISTER] Token exists: true
[REGISTER] User exists: true
[REGISTER] Complete!
```

## ❌ Si Hay un Error

Si ves un error:
1. Copia TODO el texto del error de la consola
2. Busca especialmente los logs que empiezan con `[REGISTER]`
3. Toma un screenshot del error en la app
4. Comparte ambos para ayudarte

## 🔍 Verificar que Metro Está Corriendo

Para ver los logs, necesitas tener Metro corriendo:

```bash
cd app
npm start
```

Luego abre la app en tu teléfono. Los logs aparecerán en la terminal donde corriste `npm start`.

## 🎯 Qué Se Arregló

1. ✅ **Error "Cannot read property 'role' of undefined"** - Arreglado
2. ✅ **Validación de teléfono** - Ahora agrega +58 automáticamente
3. ✅ **Mensaje de éxito** - Aparece después de registrarte
4. ✅ **Redirección automática** - Te lleva al login después de registrarte
5. ✅ **Logs detallados** - Para depurar si hay problemas

## 📞 Formato de Teléfono

Ahora puedes escribir el teléfono de dos formas:
- `4121234567` → Se convierte automáticamente a `+584121234567`
- `+584121234567` → Se mantiene igual

## 🚗 Registro de Conductor

Si te registras como conductor, también debes llenar:
- **Tipo de vehículo**: Taxi o Moto-taxi
- **Placa**: La placa de tu vehículo
- **Modelo**: Ej: Toyota Corolla 2020

## 💡 Tip

Si la app no se conecta al backend:
1. Verifica que el backend esté corriendo: `docker-compose up -d` en la carpeta `backend`
2. Verifica que tu IP sea correcta en `app/.env`: `EXPO_PUBLIC_API_URL=http://192.168.1.200:3000`
3. Verifica que tu teléfono esté en la misma red WiFi que tu computadora

## 🎉 ¡Listo!

Una vez que instales la nueva build y pruebes el registro, deberías poder:
1. Registrarte como pasajero o conductor
2. Ver el mensaje de éxito
3. Ser redirigido al login
4. Iniciar sesión con tus credenciales
5. Usar la app normalmente

---

**Tiempo estimado de instalación**: 2-3 minutos
**Tamaño del APK**: ~67.5 MB
