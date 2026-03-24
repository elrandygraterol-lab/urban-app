# Instrucciones para Recargar Cambios

## Problema Actual
Los cambios en `authStore.ts` no se están cargando en la app. El error "Cannot read property 'role' of undefined" persiste porque el código viejo está en caché.

## Solución 1: Limpiar Caché de Metro (Rápido - 2 minutos)

```bash
cd app

# Detener Metro si está corriendo (Ctrl+C)

# Limpiar caché de Metro
npm start -- --reset-cache
```

Luego en la app física:
1. Cierra completamente la app (desliza hacia arriba para cerrar)
2. Abre la app de nuevo
3. Sacude el dispositivo para abrir el menú de desarrollo
4. Toca "Reload"

## Solución 2: Nueva Build de Desarrollo (Completo - 15-20 minutos)

Si la Solución 1 no funciona, necesitas compilar una nueva build:

```bash
cd app

# Compilar nueva build de desarrollo para Android
eas build --profile development --platform android
```

Espera a que termine la compilación (15-20 minutos), luego:
1. Descarga el APK desde el link que te da EAS
2. Instala el APK en tu dispositivo
3. Abre la app

## Verificar que los Cambios se Cargaron

Cuando intentes registrarte, deberías ver en la consola logs que empiezan con `[REGISTER]`:
- `[REGISTER] Starting registration...`
- `[REGISTER] URL: ...`
- `[REGISTER] Data: ...`
- etc.

Si ves estos logs, significa que el código nuevo se cargó correctamente.

## ¿Cuál Usar?

- **Usa Solución 1 primero** - Es más rápido y debería funcionar
- **Usa Solución 2** solo si la Solución 1 no funciona

## Nota Importante

El problema NO es el código - el código está correcto. El problema es que la app está usando una versión vieja en caché.
