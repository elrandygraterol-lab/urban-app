# Instrucciones de Instalación

## Cambios Realizados

He corregido 3 problemas:

### 1. ✅ Dependencia de Testing Library
**Archivo**: `app/package.json`
- Cambiado: `"@testing-library/react-native": "^12.7.2"` (antes era `^13.3.3`)
- Razón: La versión 14.0.0 no existe, 12.7.2 es la última estable compatible con React 19

### 2. ✅ Formato de Teléfono en Registro de Conductor
**Archivo**: `app/app/(driver)/register.tsx`
- Agregado formateo automático del teléfono con prefijo `+58`
- Actualizado placeholder: `"Teléfono (ej: 4121234567)"`

### 3. ✅ Formato de Teléfono en Registro de Pasajero
**Archivo**: `app/app/(auth)/register.tsx`
- Ya estaba implementado correctamente

## Pasos para Completar la Instalación

### Opción 1: Instalación Rápida (Recomendada)

Abre PowerShell en la carpeta `app` y ejecuta:

```powershell
npm install
```

La instalación puede tomar 2-3 minutos. Ignora los warnings de deprecación (son normales).

### Opción 2: Instalación Limpia Completa

Si la Opción 1 no funciona, ejecuta:

```powershell
# Limpiar todo
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue

# Limpiar cache de npm
npm cache clean --force

# Instalar desde cero
npm install
```

## Verificar la Instalación

Después de que termine `npm install`, verifica:

```powershell
npm list @testing-library/react-native
```

Deberías ver:
```
@testing-library/react-native@12.7.2
```

## Iniciar la App

```powershell
npm run start:dev
```

## Probar el Registro

1. Abre la app en tu dispositivo
2. Ve a la pantalla de registro
3. Ingresa los datos:
   - Nombre: Tu nombre
   - Email: tu@email.com
   - Teléfono: **4121234567** (sin el +58)
   - Contraseña: mínimo 8 caracteres
   - Confirmar contraseña

4. La app automáticamente convertirá `4121234567` a `+584121234567`
5. El backend debería aceptar el registro sin errores

## Qué Esperar

### ✅ Correcto
```
LOG  Registering at: http://192.168.1.200:3000/api/auth/register/passenger
LOG  Data: { name: "...", email: "...", phone: "+584121234567", ... }
LOG  Response status: 200
LOG  Registration successful
```

### ❌ Si Hay Error
Revisa los logs del backend:
```bash
docker logs -f backend --tail 50
```

## Resumen de Cambios

| Problema | Solución | Estado |
|----------|----------|--------|
| Dependencia inexistente | Cambiar a v12.7.2 | ✅ Corregido |
| Formato de teléfono | Agregar prefijo +58 automáticamente | ✅ Corregido |
| Error de socket | Ya estaba solucionado | ✅ OK |

## Próximos Pasos

Una vez que la instalación termine y la app inicie:

1. Prueba el registro con un nuevo usuario
2. Si funciona, el backend debería crear el usuario correctamente
3. Si hay errores, comparte los logs del backend para diagnosticar

## Notas

- Los warnings de `deprecated` son normales y no afectan la funcionalidad
- La instalación puede tomar 2-3 minutos en la primera vez
- Si ves errores de red, verifica que el backend esté corriendo en `http://192.168.1.200:3000`
