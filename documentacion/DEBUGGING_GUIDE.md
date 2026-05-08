# Guía de Debugging - Backend UrbanTaxi

## Problema: El servidor se crashea sin mostrar errores claros

### Soluciones implementadas:

## 1. Scripts de desarrollo mejorados

### `npm run dev` (Recomendado - Modo rápido)
Inicia el servidor SIN verificar tipos de TypeScript (solo transpila).
Perfecto para desarrollo rápido.

```bash
npm run dev
```

### `npm run dev:strict` (Modo estricto)
Inicia el servidor verificando TODOS los tipos de TypeScript.
Útil para encontrar errores de tipos antes de hacer commit.

```bash
npm run dev:strict
```

### `npm run dev:check`
Verifica tipos de TypeScript ANTES de iniciar el servidor.

```bash
npm run dev:check
```

## 2. ¿Cuándo usar cada modo?

### Usa `npm run dev` cuando:
- ✅ Estás desarrollando features nuevas
- ✅ Quieres hot-reload rápido
- ✅ Los errores de tipos no te impiden trabajar
- ✅ Desarrollo día a día

### Usa `npm run dev:strict` cuando:
- ✅ Vas a hacer commit/push
- ✅ Quieres asegurarte que no hay errores de tipos
- ✅ Estás refactorizando código
- ✅ Antes de hacer PR

### Usa `npm run dev:check` cuando:
- ✅ Quieres verificar tipos sin iniciar el servidor
- ✅ Debugging de errores de tipos
- ✅ CI/CD pipeline

## 2. Verificar errores de TypeScript manualmente

Antes de iniciar el servidor, ejecuta:

```bash
npx tsc --noEmit
```

Esto mostrará TODOS los errores de TypeScript sin compilar.

## 3. Verificar archivos específicos

```bash
npx tsc --noEmit src/controllers/adminController.ts
npx tsc --noEmit src/services/adminService.ts
```

## 4. Ver logs en tiempo real

Los logs se guardan en:
- `logs/combined.log` - Todos los logs
- `logs/error.log` - Solo errores
- `logs/app-YYYY-MM-DD.log` - Logs por día

```bash
# Ver logs en tiempo real
tail -f logs/error.log

# En Windows PowerShell
Get-Content logs/error.log -Wait -Tail 50
```

## 5. Errores comunes y soluciones

### Error: "Property 'X' does not exist on type 'Y'"

**Causa:** Estás usando un campo que no existe en el modelo de Prisma.

**Solución:** 
1. Verifica el schema de Prisma: `backend/prisma/schema.prisma`
2. Regenera el cliente: `npm run db:generate`
3. Usa el nombre correcto del campo

**Ejemplo:**
```typescript
// ❌ Incorrecto
user.phoneNumber

// ✅ Correcto (según el schema)
user.phone
```

### Error: "Module has no default export"

**Causa:** Problema con imports de módulos CommonJS.

**Solución:** Ya está configurado en `tsconfig.json` con `esModuleInterop: true`

### Error: Server crashes sin logs

**Causa:** Error en tiempo de ejecución no capturado.

**Solución:**
1. Revisa `logs/error.log`
2. Usa `npm run dev:debug`
3. Agrega try-catch en código sospechoso

## 6. Debugging con VS Code

Crea `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "runtimeArgs": ["-r", "ts-node/register"],
      "args": ["${workspaceFolder}/backend/src/server.ts"],
      "cwd": "${workspaceFolder}/backend",
      "protocol": "inspector",
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"]
    }
  ]
}
```

## 7. Verificar dependencias

```bash
# Verificar que todas las dependencias estén instaladas
npm install

# Limpiar y reinstalar
rm -rf node_modules package-lock.json
npm install
```

## 8. Verificar base de datos

```bash
# Verificar conexión a PostgreSQL
npm run db:studio

# Regenerar cliente de Prisma
npm run db:generate

# Aplicar migraciones
npm run db:migrate
```

## 9. Logs estructurados

El logger está configurado para mostrar:
- ✅ Nivel de log (info, warn, error)
- 📅 Timestamp
- 📍 Archivo y línea de código
- 📝 Mensaje detallado

## 10. Comandos útiles

```bash
# Ver procesos de Node corriendo
tasklist | findstr node

# Matar proceso en puerto 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Ver variables de entorno
echo %NODE_ENV%

# Limpiar caché de ts-node
rm -rf node_modules/.cache
```

## 11. Checklist antes de hacer cambios

- [ ] Ejecutar `npx tsc --noEmit` para verificar tipos
- [ ] Verificar que los campos del modelo Prisma existan
- [ ] Agregar try-catch en operaciones async
- [ ] Probar en modo debug primero
- [ ] Revisar logs después de cada cambio

## 12. Contacto y soporte

Si el problema persiste:
1. Revisa los logs en `logs/error.log`
2. Ejecuta `npm run dev:check` para ver errores de tipos
3. Verifica que todas las dependencias estén actualizadas
4. Consulta la documentación de Prisma para el schema correcto
