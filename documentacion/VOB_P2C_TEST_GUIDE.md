# 🧪 Guía de Pruebas VOB P2C con Postman

## Prerequisitos

- Backend corriendo (`npm run dev` o `pm2`)
- Base de datos PostgreSQL activa
- Variables de entorno VOB configuradas en `.env`:

```bash
VOB_BASE_URL=https://200.35.106.250/rs/
VOB_API_KEY=1379
VOB_AES_KEY=DzjDFnb1CalHAisS82lIkw==
VOB_AES_IV=vcbu@syscob1.117
VOB_DISABLE_SSL_VERIFY=true
```

---

## Paso 0 — Poblar la base de datos

Ejecuta el seed para crear el viaje y el pago pendiente:

```bash
cd backend
npx ts-node --project tsconfig.json scripts/seed-vob-test.ts
```

La salida del script te dará el `rideId` y `paymentId` que necesitas para las pruebas.

> El script es **idempotente** — puedes ejecutarlo múltiples veces. Cada ejecución borra el viaje anterior y crea uno nuevo con un `rideId` diferente.

---

## Paso 1 — Obtener JWT (Login)

**Método:** `POST`  
**URL:** `http://TU_SERVIDOR:3000/api/auth/login`  
**Headers:**
```
Content-Type: application/json
```
**Body:**
```json
{
  "email": "test-pasajero-vob@urbantaxi.com",
  "password": "Test1234!"
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

Copia el valor de `token` para usarlo en el siguiente paso.

---

## Paso 2 — Verificar Pago P2C con VOB

**Método:** `POST`  
**URL:** `http://TU_SERVIDOR:3000/api/payments/verify-p2c`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer <TOKEN_DEL_PASO_1>
```
**Body:**
```json
{
  "rideId":         "<RIDE_ID_DEL_SEED>",
  "referencia":     "123456",
  "fecha":          "15/12/2024",
  "banco":          "0102",
  "telefonoP":      "5844122144339",
  "identificacion": "V25213842",
  "monto":          130.25,
  "pagador":        "Juan Pérez",
  "processPayment": true
}
```

> ⚠️ El `rideId` lo imprime el seed en consola. Cámbialo en cada ejecución del seed.

---

## Respuestas posibles del banco VOB

### ✅ Pago verificado exitosamente (HTTP 200)
```json
{
  "success": true,
  "data": {
    "success": true,
    "referenciaBVC": "000024724648",
    "status": "V"
  }
}
```
El pago en la BD pasa de `pending` → `completed`.

### ✅ Pago aprobado y procesado (HTTP 200)
```json
{
  "success": true,
  "data": {
    "success": true,
    "referenciaBVC": "000024724648",
    "status": "A"
  }
}
```

### ❌ Pago ya procesado (HTTP 409)
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "La transacción ya fue procesada"
  }
}
```
Ejecuta el seed de nuevo para obtener un `rideId` fresco.

### ❌ Pago no encontrado en el banco (HTTP 404)
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Pago no encontrado en el banco"
  }
}
```
Los datos de prueba (`telefonoP`, `identificacion`) no coinciden con ningún movimiento en el banco.

### ❌ Pago rechazado (HTTP 422)
```json
{
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Pago rechazado por el banco"
  }
}
```

### ❌ Error de cifrado (HTTP 503)
```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Servicio de pagos no disponible, intente más tarde"
  }
}
```
Verifica las credenciales VOB en el `.env`.

---

## Verificar resultado en la BD

Después de una prueba exitosa, confirma que el pago cambió a `completed`:

```sql
SELECT id, ride_id, status, transaction_id, processed_at
FROM payments
WHERE ride_id = '<RIDE_ID_DEL_SEED>';
```

O con Prisma Studio:
```bash
cd backend
npx prisma studio
```

---

## Flujo completo resumido

```
seed-vob-test.ts
  └─ Crea pasajero (test-pasajero-vob@urbantaxi.com)
  └─ Crea conductor (test-conductor-vob@urbantaxi.com)
  └─ Crea viaje status=completed, finalFare=130.25
  └─ Crea pago status=pending
  └─ Imprime rideId en consola

POST /api/auth/login
  └─ Devuelve JWT del pasajero

POST /api/payments/verify-p2c
  └─ Backend cifra payload con AES-128-CBC (KEY + IV del .env)
  └─ Envía { hs: "1379", dt: "payload_cifrado" } a VOB
  └─ VOB responde con status A o V
  └─ Backend actualiza pago → completed
  └─ Backend notifica al conductor
  └─ Devuelve { success: true, data: { referenciaBVC, status } }
```

---

## Datos de prueba oficiales VOB

| Campo | Valor |
|-------|-------|
| `telefonoP` | `5844122144339` |
| `identificacion` | `V25213842` |
| `banco` | `0102` |
| `monto` | `130.25` (debe coincidir con `finalFare` del viaje) |

> Estos datos son los proporcionados por el banco para el ambiente de pruebas. Mantenerlos fijos en todas las pruebas.
