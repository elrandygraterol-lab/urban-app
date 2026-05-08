# Guía de Build - Backend UrbanTaxi

## Compilación para Producción

### Proceso de Build

El proceso de build hace lo siguiente:

1. **Compila CSS con Tailwind**
   ```bash
   npm run build:css
   ```

2. **Compila TypeScript a JavaScript**
   ```bash
   tsc
   ```
   - Compila archivos `.ts` de `src/` a `dist/`
   - Genera source maps
   - Genera archivos de declaración `.d.ts`

3. **Copia archivos estáticos**
   ```bash
   npm run copy:assets
   ```
   - Copia `views/` → `dist/views/`
   - Copia `public/` → `dist/public/`
   - Copia `prisma/` → `dist/prisma/`

### Comando completo

```bash
npm run build
```

Esto ejecuta todos los pasos anteriores en orden.

## Estructura de Directorios

### Desarrollo (src/)
```
backend/
├── src/              # Código TypeScript
├── views/            # Plantillas EJS
├── public/           # Archivos estáticos (CSS, JS, imágenes)
├── prisma/           # Schema de base de datos
└── uploads/          # Archivos subidos por usuarios
```

### Producción (dist/)
```
backend/
└── dist/
    ├── *.js          # JavaScript compilado
    ├── views/        # Plantillas EJS (copiadas)
    ├── public/       # Archivos estáticos (copiados)
    └── prisma/       # Schema de base de datos (copiado)
```

## Iniciar en Producción

```bash
# 1. Compilar
npm run build

# 2. Iniciar servidor
npm start
# o
node dist/server.js
```

## Variables de Entorno

El servidor detecta automáticamente el entorno:

- **Desarrollo:** `NODE_ENV=development`
  - Lee archivos de `views/` y `public/`
  
- **Producción:** `NODE_ENV=production`
  - Lee archivos de `dist/views/` y `dist/public/`

## Troubleshooting

### Error: Cannot find module 'views/...'

**Causa:** Los archivos estáticos no se copiaron a `dist/`

**Solución:**
```bash
npm run copy:assets
```

### Error: CSS no se carga en producción

**Causa:** El CSS no se compiló o no se copió

**Solución:**
```bash
npm run build:css
npm run copy:assets
```

### Verificar que todo se copió correctamente

```bash
# Windows PowerShell
Get-ChildItem -Recurse dist/views
Get-ChildItem -Recurse dist/public

# Linux/Mac
ls -R dist/views
ls -R dist/public
```

## Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Desarrollo (modo rápido, sin verificar tipos) |
| `npm run dev:strict` | Desarrollo (modo estricto, verifica tipos) |
| `npm run build` | Compilar para producción |
| `npm run build:css` | Solo compilar CSS |
| `npm run copy:assets` | Solo copiar archivos estáticos |
| `npm start` | Iniciar servidor de producción |

## CI/CD Pipeline

Ejemplo de pipeline para GitHub Actions:

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
        working-directory: ./backend
      
      - name: Build
        run: npm run build
        working-directory: ./backend
      
      - name: Run tests
        run: npm test
        working-directory: ./backend
      
      - name: Deploy
        run: |
          # Tu script de deploy aquí
```

## Docker Build

Si usas Docker, asegúrate de copiar los archivos necesarios:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./
RUN npm ci --only=production

# Copiar código compilado
COPY dist/ ./dist/

# Copiar archivos estáticos (si no están en dist/)
COPY views/ ./dist/views/
COPY public/ ./dist/public/

# Copiar Prisma
COPY prisma/ ./dist/prisma/

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

## Notas Importantes

1. **Nunca commitear `dist/`** - Está en `.gitignore`
2. **Siempre ejecutar `npm run build` antes de deploy**
3. **Verificar que NODE_ENV=production en producción**
4. **Los archivos en `uploads/` NO se copian** (son generados por usuarios)
