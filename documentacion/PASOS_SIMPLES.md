# 🎯 Pasos Simples - Instalar y Probar

## 1️⃣ Desinstalar App Anterior

En tu teléfono Android:
- Mantén presionado el ícono de UrbanTaxi
- Toca "Desinstalar"
- Confirma

## 2️⃣ Instalar Nueva Build

**Opción A - QR Code** (más fácil):
- Abre la cámara de tu teléfono
- Apunta al código QR que apareció en tu computadora
- Toca la notificación
- Descarga e instala

**Opción B - Link**:
- Abre este link en tu teléfono:
  https://expo.dev/accounts/randygraterol07/projects/app-taxis/builds/44fd3d2a-d8f8-4ab4-a673-37b6afbfddfc
- Toca "Download"
- Instala el APK

## 3️⃣ Abrir Metro (en tu computadora)

```bash
cd app
npm start
```

Deja esta ventana abierta para ver los logs.

## 4️⃣ Probar Registro

En tu teléfono:

1. Abre la app UrbanTaxi
2. Toca "Crear cuenta"
3. Llena:
   - Nombre: Randy Graterol
   - Email: randy@test.com
   - Teléfono: 4121234567
   - Contraseña: 12345678
   - Confirmar: 12345678
4. Toca "Registrarse"

## 5️⃣ Verificar Éxito

Deberías ver:
- ✅ Un mensaje: "Registro exitoso"
- ✅ La app te lleva al login automáticamente
- ✅ En la computadora (Metro) ves logs con `[REGISTER]`

## 6️⃣ Iniciar Sesión

1. En el login, escribe:
   - Email: randy@test.com
   - Contraseña: 12345678
2. Toca "Iniciar sesión"
3. ✅ Deberías entrar a la app

## ❌ Si Hay Error

1. Copia el error de la consola de Metro
2. Toma screenshot del error en el teléfono
3. Comparte ambos

## 📞 Ayuda Rápida

**Backend no responde**:
```bash
cd backend
docker-compose up -d
```

**Metro no inicia**:
```bash
cd app
npm start -- --reset-cache
```

**App no se conecta**:
- Verifica que tu teléfono esté en la misma WiFi
- Verifica que `app/.env` tenga: `EXPO_PUBLIC_API_URL=http://192.168.1.200:3000`

---

**¡Eso es todo!** 🎉

Si todo funciona, ya puedes registrarte e iniciar sesión en la app.
