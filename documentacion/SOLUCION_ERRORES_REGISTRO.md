# Solución a Errores de Registro y Dependencias

## Problemas Identificados

### 1. Error de Dependencia: @testing-library/react-native
```
npm error notarget No matching version found for @testing-library/react-native@^14.0.0
```

**Causa**: La versión `^14.0.0` no existe. Las versiones disponibles son:
- v12.x (compatible con React Native 0.71+)
- v13.x (experimental, no estable)

**Solución**: Cambiar a `^12.7.2` (última versión estable compatible con React 19)

### 2. Error de Registro: Formato de Teléfono
```
ERROR Registration error: [Error: Registration failed]
```

**Causa**: El backend requiere números de teléfono en formato internacional con código de país (ej: `+584121234567`), pero la app enviaba números sin el prefijo `+58`.

**Solución**: Agregar automáticamente el prefijo `+58` si el usuario no lo incluye.

## Cambios Realizados

### 1. Actualización de package.json
```json
{
  "devDependencies": {
    "@testing-library/react-native": "^12.7.2"  // Cambiado de ^13.3.3
  }
}
```

### 2. Actualización de app/(driver)/register.tsx

**Placeholder actualizado**:
```tsx
placeholder="Teléfono (ej: 4121234567)"  // Antes: "+58 412 1234567"
```

**Formateo automático del teléfono**:
```tsx
const handleRegister = async () => {
  if (!validateForm()) return;

  try {
    // Format phone number with international prefix if not present
    let formattedPhone = formData.phone.trim();
    if (!formattedPhone.startsWith('+')) {
      // Add Venezuela country code (+58) by default
      formattedPhone = `+58${formattedPhone}`;
    }

    await register({
      // ... otros campos
      phone: formattedPhone,  // Usar el teléfono formateado
    });
  }
}
```

### 3. Ya Implementado en app/(auth)/register.tsx
El mismo formateo ya estaba implementado en la pantalla de registro de pasajeros.

## Próximos Pasos

1. **Limpiar e instalar dependencias**:
   ```bash
   npm run clean:full
   ```

2. **Verificar instalación**:
   ```bash
   npm list @testing-library/react-native
   ```
   Debería mostrar: `@testing-library/react-native@12.7.2`

3. **Iniciar la app**:
   ```bash
   npm run start:dev
   ```

4. **Probar registro**:
   - Ingresar teléfono sin prefijo: `4121234567`
   - La app automáticamente lo convertirá a: `+584121234567`
   - El backend debería aceptar el formato

## Formato de Teléfono Esperado

**Usuario ingresa**: `4121234567`
**App envía al backend**: `+584121234567`
**Backend valida**: ✅ Formato internacional correcto

## Notas Importantes

- El código de país `+58` (Venezuela) se agrega automáticamente
- Si el usuario ya incluye el `+`, no se duplica
- El backend requiere el formato: `+[código país][número]`
- Ejemplo válido: `+584121234567`, `+584241234567`, `+584141234567`
