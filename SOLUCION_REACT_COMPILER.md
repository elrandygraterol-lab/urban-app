# 🔧 Solución: Error "react/compiler-runtime"

## Problema
```
Unable to resolve "react/compiler-runtime" from "app\(auth)\_layout.tsx"
```

## Causa
El **React Compiler** estaba habilitado en `app.json` pero falta el paquete `react-compiler-runtime`.

## Solución Aplicada

Deshabilitado el React Compiler en `app.json`:

```json
// ANTES:
"experiments": {
  "typedRoutes": true,
  "reactCompiler": true  // ❌ Causaba el error
}

// DESPUÉS:
"experiments": {
  "typedRoutes": true  // ✅ Solo typed routes
}
```

## Pasos para Continuar

1. **Detén el servidor** si está corriendo (`Ctrl+C`)

2. **Limpia el cache**:
   ```bash
   npx expo start --clear
   ```

3. **O reinicia normalmente**:
   ```bash
   npx expo start --lan --dev-client
   ```

4. **Escanea el QR** con tu app instalada

## ¿Por Qué Deshabilitamos React Compiler?

- React Compiler es una característica **experimental** de React 19
- Requiere paquetes adicionales que no están instalados
- No es necesario para el funcionamiento de la app
- Puede causar problemas de compatibilidad

## Si Quieres Habilitarlo en el Futuro

Si en el futuro quieres usar React Compiler:

1. Instala el paquete requerido:
   ```bash
   npm install react-compiler-runtime --legacy-peer-deps
   ```

2. Habilita en `app.json`:
   ```json
   "experiments": {
     "typedRoutes": true,
     "reactCompiler": true
   }
   ```

3. Recompila el Development Build:
   ```bash
   npm run build:dev:android
   ```

Por ahora, no es necesario y la app funcionará perfectamente sin él.
