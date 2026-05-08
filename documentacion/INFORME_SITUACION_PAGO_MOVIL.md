# Informe de Situación: Integración Pago Móvil P2C - Banco Venezolano de Crédito (BVC)

## 📝 Resumen del Problema
Se han presentado dificultades técnicas para establecer la conexión entre el servidor VPS (Hostinger, IP: `31.97.171.120`) y el ambiente de desarrollo del Banco Venezolano de Crédito para el servicio de verificación de Pago Móvil P2C.

### Hallazgos Iniciales
1.  **Inconsistencia en Documentación:** La documentación original presentaba dos IPs distintas (`200.35.106.250` y `200.135.106.250`).
2.  **Bloqueo de Conexión:** Las pruebas iniciales de conectividad TCP (puerto 443) resultaron en timeout desde la IP del servidor de aplicaciones.
3.  **Confirmación del Banco:** El banco confirmó que la IP correcta es **`200.35.106.250`** y que el puerto 443 está habilitado.

---

## 🛠️ Requerimientos Técnicos del Banco (Desarrollo)

### IPs del Banco y VPS
- **IP Correcta del Banco (Endpoint):** `200.35.106.250` (CONEXIÓN VERIFICADA ✅)
- **IPs de la Aplicación Habilitadas en Whitelist del Banco:**
  - `31.97.171.120` (VPS Hostinger)
  - `190.103.29.28`

### Credenciales de Certificación (Ambiente de Desarrollo)
| Parámetro | Valor |
|-----------|-------|
| Código Departamento (HS) | `1379` |
| Nombre Departamento | `INV ZELIDETH (SOL. DIGITALES)` |
| Status | `Activo` |
| Hash (AES Key) | `DzjDFnb1Ca1HAisS821Ikw==` |
| Vector (AES IV) | `vcbu@syscob1.117` |
| Llave (Adicional) | `Saso@cob!1.10007` |

### Pasos Obligatorios para Conexión
1.  **Endpoint Correcto:** `https://200.35.106.250/rs/verifyP2C`
2.  **Omitir Validación SSL (Trust All):** Debido a que es un ambiente de desarrollo, el certificado no debe ser validado.
3.  **Configuración de Hosts:** Se debe mapear la IP al nombre de host en el archivo `/etc/hosts` del servidor:
    ```
    200.35.106.250       cbdesa.venezolano.com
    ```

---

## 🚀 Implementación y Cambios Realizados

### 1. Configuración del Backend
Se ha verificado y ajustado la implementación para cumplir con los requerimientos:

- **Archivo:** `backend/src/controllers/paymentController.ts`
  - Se asegura el uso de las variables de entorno para la configuración del `VobClient`.
- **Archivo:** `backend/src/services/vob/vobClient.ts`
  - El cliente ya soporta la opción `disableSslVerify` (que activa `rejectUnauthorized: false`), cumpliendo con el requerimiento de "Trust All".
  - Se utiliza el **Código Departamento (1379)** como valor del campo `hs` en las peticiones.

### 2. Variables de Entorno Recomendadas (.env)
Para el correcto funcionamiento en el VPS, se deben configurar las siguientes variables:

```env
# URL Base corregida (IP 200.35.106.250)
VOB_BASE_URL=https://200.35.106.250/rs/

# Credenciales de Desarrollo
VOB_API_KEY=1379
VOB_AES_KEY=DzjDFnb1Ca1HAisS821Ikw==
VOB_AES_IV=vcbu@syscob1.117

# Habilitar el "Trust All" para desarrollo
VOB_DISABLE_SSL_VERIFY=true
```

---

## 📋 Pasos a Seguir en el VPS (Hostinger)

1.  **Editar `/etc/hosts`:**
    Ejecutar `sudo nano /etc/hosts` y agregar la línea:
    `200.35.106.250       cbdesa.venezolano.com`
2.  **Actualizar variables de entorno:**
    Asegurarse de que el archivo `.env` en el servidor tenga la IP correcta (`200.35.106.250`) y las credenciales de desarrollo mencionadas arriba.
3.  **Reiniciar el servicio:**
    Reiniciar el backend para que tome los nuevos cambios de configuración.

---

## 🔍 Notas de Verificación en VPS

> **Importante:** Es normal que el comando `ping cbdesa.venezolano.com` de un resultado de "100% packet loss". Los servidores del banco suelen bloquear el protocolo ICMP. 
> 
> Para verificar la conexión real, use:
> `curl -kv https://cbdesa.venezolano.com/rs/verifyP2C`

---

## 🧪 Datos de Prueba Proporcionados por el Banco

### Movimiento de Pago Móvil para Certificación
| Campo | Valor |
|-------|-------|
| Cédula | `25.213.842` |
| Teléfono | `04122144339` |
| Fecha | `27-04-2026` |
| Banco | `0104` |
| processPayment | `true` |

### Datos de Prueba Adicionales
| Campo | Valor |
|-------|-------|
| Teléfono Pagador | `584122144339` |
| Cédula Pagador | `V25213842` |
| Monto | (Según la carrera) |
| processPayment | `true` |

**Nota:** El sistema formatea automáticamente el teléfono al formato internacional requerido (con prefijo 58) si es necesario.
 
 **Nota:** Este informe sirve como evidencia de la transición de la IP `200.135.106.250` (errónea) a la `200.35.106.250` (correcta) y la implementación de la política de seguridad relajada para el ambiente de pruebas.

---

## 🚀 Guía de Pruebas con Postman (Paso a Paso)

Sigue estos pasos para verificar la integración desde tu computadora apuntando al VPS.

### Paso 1: Autenticación (Login)
Para interactuar con la API, primero debes obtener un token de seguridad.
- **Método:** `POST`
- **URL:** `https://31.97.171.120:3000/api/auth/login`
- **Body (JSON):**
  ```json
  {
      "email": "test-pasajero-vob@urbantaxi.com",
      "password": "Test1234!"
  }
  ```
- **Acción:** Copia el valor de `token` que recibas en la respuesta.

### Paso 2: Configurar el Token en Postman
1. Crea una nueva pestaña de petición en Postman.
2. Ve a la pestaña **"Auth"** o **"Authorization"**.
3. En **Type**, selecciona **"Bearer Token"**.
4. Pega el token que copiaste en el Paso 1.

### Paso 3: Verificar Pago P2C
Ahora enviarás los datos para que el VPS consulte al banco.
- **Método:** `POST`
- **URL:** `https://31.97.171.120:3000/api/payments/verify-p2c`
- **Body (JSON):**
  ```json
  {
      "rideId": "82d2145f-64c5-4fc5-9fde-a6e1fbf9752f",
      "referencia": "123456789012",
      "fecha": "27/04/2026",
      "banco": "0104",
      "telefonoP": "04122144339",
      "identificacion": "25.213.842",
      "monto": 130.25,
      "pagador": "Juan Pérez",
      "processPayment": true
  }
  ```

### 💡 Tips para las Pruebas:
- **rideId:** Usa siempre el ID generado por el script de seed (`82d2145f-64c5-4fc5-9fde-a6e1fbf9752f`).
- **Monto:** Debe ser exactamente `130.25`, de lo contrario el backend rechazará la petición antes de ir al banco por seguridad.
- **SSL en Postman:** Si te da error de certificado, ve a `Settings` de Postman y desactiva **"SSL certificate verification"**.
- **Logs:** Si algo falla, revisa los logs en el VPS con `pm2 logs`.
