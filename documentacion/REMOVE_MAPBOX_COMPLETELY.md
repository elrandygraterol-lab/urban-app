# 🗑️ Remover Mapbox Completamente

Si deseas remover completamente Mapbox del proyecto (después de verificar que Google Maps funciona correctamente), sigue estos pasos:

---

## ⚠️ Advertencia

**Antes de remover Mapbox:**
1. Asegúrate de que Google Maps está funcionando correctamente
2. Realiza un backup del proyecto
3. Verifica que todos los tests pasan
4. Considera mantener Mapbox para rollback rápido

---

## 📋 Archivos a Remover

### Backend

#### Servicios
```bash
rm backend/src/services/mapboxService.ts
```

#### Configuración
```bash
rm backend/config/mapbox-config.ts
```

#### Tests
```bash
rm backend/src/services/__tests__/mapboxService.test.ts
```

### Frontend

#### Mocks
```bash
rm app/jest.mocks/mapboxMock.js
```

---

## 🔧 Cambios en Archivos

### Backend - package.json

No hay cambios necesarios (axios ya está instalado para Google Maps)

### Frontend - package.json

Remover dependencia de Mapbox (si existe):
```bash
cd app
npm uninstall @react-native-mapbox-gl/maps @mapbox/mapbox-sdk
```

### Backend - .env

Remover variable:
```bash
# Remover esta línea:
# MAPBOX_API_KEY=...
```

### Backend - .env.example

Remover variable:
```bash
# Remover esta línea:
# MAPBOX_API_KEY=your_mapbox_api_key_here
```

### Frontend - .env

Remover variable (si existe):
```bash
# Remover esta línea:
# MAPBOX_API_KEY=...
```

### Frontend - .env.example

Remover variable (si existe):
```bash
# Remover esta línea:
# MAPBOX_API_KEY=your_mapbox_api_key_here
```

---

## 🔍 Verificar que no hay referencias a Mapbox

### Backend
```bash
cd backend
grep -r "mapbox" --include="*.ts" --include="*.js" --include="*.json" .
# No debe retornar resultados (excepto en comentarios)
```

### Frontend
```bash
cd app
grep -r "mapbox" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" .
# No debe retornar resultados (excepto en comentarios)
```

---

## 🧪 Testing

### Backend
```bash
cd backend
npm test
# Todos los tests deben pasar
```

### Frontend
```bash
cd app
npm test
# Todos los tests deben pasar
```

### Compilación
```bash
# Backend
cd backend
npm run build

# Frontend
cd app
npm run build
```

---

## 📝 Actualizar Documentación

### README.md
Actualizar sección de mapas:

```markdown
## 🗺️ Mapas

El proyecto utiliza:
- **Google Maps SDK** para visualización de mapas y geocodificación
- **OSRM** para cálculo de rutas

### Configuración
1. Obtener Google Maps API Key en [Google Cloud Console](https://console.cloud.google.com/)
2. Configurar `GOOGLE_MAPS_API_KEY` en variables de entorno
3. Iniciar servidor backend y frontend
```

---

## 🔄 Rollback (Si es Necesario)

Si necesitas volver a Mapbox:

```bash
# Restaurar archivos removidos
git checkout backend/src/services/mapboxService.ts
git checkout backend/config/mapbox-config.ts
git checkout app/jest.mocks/mapboxMock.js

# Reinstalar dependencias
cd app
npm install @react-native-mapbox-gl/maps @mapbox/mapbox-sdk

# Restaurar variables de entorno
# Editar .env y .env.example
```

---

## ✅ Checklist de Remoción

- [ ] Remover archivos de Mapbox
- [ ] Remover dependencias de npm
- [ ] Remover variables de entorno
- [ ] Verificar que no hay referencias a Mapbox
- [ ] Ejecutar tests
- [ ] Compilar proyecto
- [ ] Actualizar documentación
- [ ] Hacer commit de cambios

---

## 📊 Resumen

Después de remover Mapbox:

**Archivos Removidos**: ~10 archivos
**Dependencias Removidas**: 2 paquetes
**Líneas de Código Removidas**: ~500 líneas
**Tamaño del Proyecto**: Reducido ~2MB

**Beneficios**:
- ✅ Proyecto más limpio
- ✅ Menos dependencias
- ✅ Menor tamaño de bundle
- ✅ Menos mantenimiento

---

## 💡 Consideraciones

1. **Mantener Documentación**: Considera mantener documentos de migración para referencia histórica
2. **Mantener Backup**: Mantén un backup del código con Mapbox por si necesitas rollback
3. **Comunicar Cambios**: Informa al equipo sobre la remoción de Mapbox
4. **Monitorear**: Verifica que Google Maps funciona correctamente después de la remoción

---

## 📞 Soporte

Si encuentras problemas después de remover Mapbox:
1. Consulta `GOOGLE_MAPS_MIGRATION_GUIDE.md`
2. Revisa los logs de error
3. Verifica que Google Maps API Key es válida
4. Considera hacer rollback a Mapbox temporalmente
