# Correcciones para Expo Go - App de Taxis

## Problemas Solucionados ✅

### 1. Error de `darkGray` undefined
**Problema**: Múltiples pantallas de driver mostraban error `darkGray is not defined`

**Causa**: Los archivos importaban `COLORS` o `colors` desde `@/constants/theme`, pero el archivo exporta `Colors` (con mayúscula C).

**Solución**: Actualicé todos los imports para usar alias correctos:
```typescript
// Antes (incorrecto)
import { COLORS } from '@/constants/theme';
import { colors } from '@/constants/theme';

// Después (correcto)
import { Colors as COLORS } from '@/constants/theme';
import { Colors as colors } from '@/constants/theme';
```

**Archivos corregidos**:
- `app/app/(driver)/documents-upload.tsx`
- `app/app/(driver)/register.tsx`
- `app/app/(driver)/verification-status.tsx`
- `app/app/(driver)/active-ride.tsx`
- `app/app/(driver)/profile.tsx`
- `app/app/(driver)/documents.tsx`
- `app/app/(driver)/earnings.tsx`
- `app/app/(driver)/ride-history.tsx`
- `app/app/(driver)/index.tsx`
- `app/components/RatingModal.tsx`

---

### 2. Error de `RNMapsAirModule` (react-native-maps)
**Problema**: `react-native-maps` no funciona en Expo Go

**Causa**: Expo Go no incluye módulos nativos como `react-native-maps`. Requiere un Development Build.

**Solución**: Agregué detección de Expo Go en `active-ride.tsx` que muestra un mensaje informativo en lugar del mapa:

```typescript
const isExpoGo = Constants.appOwnership === 'expo';

{isExpoGo ? (
  <View>
    <Text>🗺️ Mapa no disponible en Expo Go</Text>
    <Text>react-native-maps requiere un Development Build</Text>
    <Text>Ejecuta: npx expo run:android</Text>
  </View>
) : (
  <MapView ... />
)}
```

---

### 3. Error de Push Notifications
**Problema**: Expo Go SDK 53+ no soporta push notifications

**Causa**: Expo removió el soporte de push notifications de Expo Go en SDK 53+.

**Solución**: Agregué detección de Expo Go en `app/hooks/useNotifications.ts`:

```typescript
const isExpoGo = Constants.appOwnership === 'expo';

useEffect(() => {
  if (isExpoGo) {
    console.warn('Push notifications are not supported in Expo Go. Please use a Development Build.');
    setError('Push notifications require a Development Build');
    return;
  }
  // ... resto del código de notificaciones
}, []);
```

---

## Recomendaciones 📱

### Para Desarrollo Completo (Recomendado)

Crea un **Development Build** para tener acceso completo a todas las funcionalidades.

**Opción 1: EAS Build (Recomendado - No requiere Android Studio/Xcode)**
```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login
eas login

# Compilar Android (en la nube)
cd app
eas build --profile development --platform android

# Compilar iOS (en la nube, no requiere Mac)
eas build --profile development --platform ios
```

**Opción 2: Build Local (Requiere Android Studio/Xcode)**
```bash
# Android (requiere Android Studio)
npx expo run:android

# iOS (requiere Mac + Xcode)
npx expo run:ios
```

**Ventajas del Development Build**:
- ✅ Soporte completo de `react-native-maps`
- ✅ Push notifications funcionando
- ✅ Todos los módulos nativos disponibles
- ✅ Experiencia idéntica a producción
- ✅ Hot reload como Expo Go

**Costos EAS Build**:
- 🆓 Plan Free: 30 builds/mes (suficiente para desarrollo)
- 💰 Plan Production: $29/mes (builds ilimitados)

---

### Para Testing Rápido con Expo Go

Si quieres seguir usando Expo Go para pruebas rápidas:

**Funcionalidades que SÍ funcionan**:
- ✅ Autenticación (login/registro)
- ✅ Navegación entre pantallas
- ✅ Formularios y validaciones
- ✅ UI/UX general
- ✅ Subida de documentos (Cloudinary)
- ✅ Llamadas a API del backend

**Funcionalidades que NO funcionan**:
- ❌ Mapas (react-native-maps)
- ❌ Push notifications
- ❌ Tracking de ubicación en tiempo real

---

## Próximos Pasos 🚀

1. **Prueba la app en Expo Go** - Los errores de `darkGray` ya están corregidos
2. **Verifica las pantallas de driver** - Deberían cargar sin errores ahora
3. **Crea un Development Build** para probar mapas y notificaciones:
   
   **Opción Rápida (Recomendada)**:
   ```bash
   npm install -g eas-cli
   eas login
   cd app
   eas build --profile development --platform android
   ```
   
   Ver guía completa: `app/INICIO_RAPIDO_EAS.md`

---

## Comandos Útiles

```bash
# Iniciar Expo Go
cd app
npm start

# Crear Development Build (Android)
npx expo run:android

# Crear Development Build (iOS)
npx expo run:ios

# Limpiar caché si hay problemas
npx expo start -c
```

---

## Notas Adicionales

- Los cambios son compatibles tanto con Expo Go como con Development Builds
- La app detecta automáticamente el entorno y ajusta las funcionalidades
- No se requieren cambios adicionales para producción

## ❓ Preguntas Frecuentes

### ¿Los mapas y notificaciones funcionarán en mi app final?
**¡SÍ! 100% funcionales.** Que no funcionen en Expo Go NO significa que no funcionen en tu app. Expo Go es solo una herramienta temporal de desarrollo. Tu app compilada (Development Build o Production) tendrá TODO funcionando perfectamente.

### ¿Es gratis compilar con EAS Build?
**Sí, con límites.** El plan Free incluye 30 builds/mes (suficiente para desarrollo). Solo necesitas pagar si requieres más de 30 builds/mes.

### ¿Necesito Mac para compilar iOS?
**No con EAS Build.** EAS compila en la nube, así que puedes compilar iOS desde Windows. Solo necesitas una cuenta de Apple Developer ($99/año) para instalar en dispositivos iOS.

### ¿Cuánto tarda la primera compilación?
**10-15 minutos** para Android, **15-20 minutos** para iOS. Es una sola vez. Después solo recompilas cuando cambias módulos nativos.

### ¿Pierdo el hot reload?
**No.** Development Build tiene hot reload igual que Expo Go. Cambias código y se actualiza automáticamente.
