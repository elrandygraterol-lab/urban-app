# 🔍 Debug: Error de Registro

## 📊 Estado Actual

- ✅ App se conecta al backend (ya no hay "Network request failed")
- ❌ Registro falla con "Registration failed"
- ❓ Necesitamos ver qué error específico devuelve el backend

## 🚀 Pasos para Debugging

### 1. Preparar Logs del Backend

Abre una terminal y ejecuta:

```bash
cd backend
docker-compose logs -f backend
```

Deja esta terminal abierta para ver los logs en tiempo real.

### 2. Recargar la App

En la app en tu dispositivo:
- Agita el dispositivo
- Selecciona "Reload"

### 3. Intentar Registrarse

1. Abre la pantalla de registro
2. Llena el formulario
3. Presiona "Registrarse"

### 4. Ver los Logs

Ahora deberías ver información en **ambas terminales**:

#### En la Terminal de la App (npm run start:dev)

Busca estos logs:
```
LOG  Registering at: http://192.168.1.200:3000/api/auth/register/passenger
LOG  Data: { email: "...", name: "...", ... }
LOG  Response status: 400 (o el código que sea)
ERROR Registration error response: { ... }
```

#### En la Terminal del Backend (docker-compose logs)

Busca:
```
[http]: Incoming request [req:xxx] {"method":"POST","url":"/api/auth/register/passenger"}
[error]: ... (el error específico)
```

## 📝 Información que Necesito

Después de intentar registrarte, copia y pega:

### De la App:
```
LOG  Registering at: ...
LOG  Response status: ...
ERROR Registration error response: ...
```

### Del Backend:
```
[http]: Incoming request ...
[error]: ...
```

## 🔍 Posibles Causas del Error

### 1. Base de Datos No Inicializada
```
Error: relation "users" does not exist
```
**Solución**: Ejecutar migraciones
```bash
cd backend
docker-compose exec backend npm run prisma:migrate
```

### 2. Validación de Datos
```
Error: Invalid email format
Error: Password too short
Error: Phone number invalid
```
**Solución**: Verificar que los datos del formulario sean correctos

### 3. Usuario Ya Existe
```
Error: User with this email already exists
```
**Solución**: Usar otro email o eliminar el usuario existente

### 4. Campos Requeridos Faltantes
```
Error: Missing required field: name
```
**Solución**: Verificar que todos los campos requeridos estén presentes

## 🛠️ Comandos Útiles

### Ver estado del backend
```bash
cd backend
docker-compose ps
```

### Ver logs completos
```bash
docker-compose logs backend
```

### Reiniciar backend
```bash
docker-compose restart backend
```

### Ejecutar migraciones
```bash
docker-compose exec backend npm run prisma:migrate
```

### Ver base de datos
```bash
docker-compose exec backend npx prisma studio
```

## 📊 Checklist de Verificación

Antes de intentar registrarte, verifica:

- [ ] Backend está corriendo (`docker-compose ps`)
- [ ] PostgreSQL está healthy
- [ ] Redis está healthy
- [ ] Logs del backend están visibles (`docker-compose logs -f backend`)
- [ ] App está recargada con los nuevos logs
- [ ] Estás usando un email que no existe en la BD

## 🎯 Próximos Pasos

1. **Abre 2 terminales**:
   - Terminal 1: `cd backend && docker-compose logs -f backend`
   - Terminal 2: `cd app && npm run start:dev` (ya está corriendo)

2. **Recarga la app** en el dispositivo

3. **Intenta registrarte** y observa los logs

4. **Copia los logs** que aparezcan y pégalos aquí

Con esa información podré identificar el problema exacto y solucionarlo.

## 💡 Tip

Si ves muchos logs de "health check", puedes filtrarlos:

```bash
docker-compose logs -f backend | grep -v "health"
```

O en PowerShell:
```powershell
docker-compose logs -f backend | Select-String -Pattern "register|POST|error" -NotMatch "health"
```
