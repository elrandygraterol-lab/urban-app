# 🎨 Sistema de Diseño UrbanTaxi

## Descripción General

Este documento describe el sistema de diseño completo de UrbanTaxi, incluyendo paleta de colores, tipografía, componentes reutilizables y configuración multiidioma.

---

## 🎯 Paleta de Colores

### Colores Primarios

| Color | Código | Uso |
|-------|--------|-----|
| **Primary Green** | `#2FB908` | Botones primarios, acciones principales, bordes activos |
| **Light Green** | `#4CCB3A` | Gradientes, elementos secundarios |
| **Dark Green** | `#269006` | Estados hover, estados activos |
| **Secondary Green** | `#3DD10A` | Acentos secundarios |
| **Very Light Green** | `#9EF08A` | Fondos, elementos de baja importancia |

### Colores de Acento

| Color | Código | Uso |
|-------|--------|-----|
| **Orange** | `#F89C0A` | Botones de cancelación, advertencias |
| **Light Orange** | `#FBBF24` | Estados hover de cancelación |
| **Dark Orange** | `#E08809` | Estados hover oscuros de cancelación |

### Colores Neutros

| Color | Código | Uso |
|-------|--------|-----|
| **Dark Gray** | `#1f2937` | Texto principal, encabezados |
| **Medium Gray** | `#6b7280` | Texto secundario |
| **Light Gray** | `#9ca3af` | Placeholders |
| **White** | `#FFFFFF` | Fondos, tarjetas |
| **Black** | `#000000` | Texto de alto contraste |
| **Background** | `#f9fafb` | Fondo de pantalla |

### Colores Semánticos

| Color | Código | Uso |
|-------|--------|-----|
| **Success** | `#2FB908` | Mensajes de éxito |
| **Warning** | `#F89C0A` | Advertencias |
| **Error** | `#ef4444` | Errores |
| **Info** | `#3b82f6` | Información |

---

## 📝 Tipografía

### Estilos de Texto

```typescript
// Encabezado 1 (H1)
fontSize: 32px
fontWeight: 700
lineHeight: 40px
color: #1f2937

// Encabezado 2 (H2)
fontSize: 24px
fontWeight: 600
lineHeight: 32px
color: #1f2937

// Encabezado 3 (H3)
fontSize: 20px
fontWeight: 600
lineHeight: 28px
color: #1f2937

// Body (Texto principal)
fontSize: 16px
fontWeight: 400
lineHeight: 24px
color: #1f2937

// Body Small
fontSize: 14px
fontWeight: 400
lineHeight: 20px
color: #1f2937

// Caption (Texto pequeño)
fontSize: 12px
fontWeight: 400
lineHeight: 16px
color: #9ca3af

// Button
fontSize: 16px
fontWeight: 600
lineHeight: 24px

// Input
fontSize: 16px
fontWeight: 400
lineHeight: 24px
color: #1f2937

// Placeholder
fontSize: 16px
fontWeight: 400
lineHeight: 24px
color: #9ca3af
```

---

## 🧩 Componentes Reutilizables

### Button

Componente de botón con múltiples variantes.

**Ubicación**: `app/components/ui/Button.tsx`

**Props**:
- `onPress` (function): Callback al presionar
- `title` (string): Texto del botón
- `variant` ('primary' | 'cancel' | 'secondary'): Estilo del botón
- `size` ('small' | 'medium' | 'large'): Tamaño del botón
- `disabled` (boolean): Estado deshabilitado
- `loading` (boolean): Mostrar indicador de carga
- `style` (ViewStyle): Estilos personalizados
- `icon` (ReactNode): Icono opcional

**Ejemplo**:
```tsx
import { Button } from '@/components/ui';

<Button
  title="Solicitar viaje"
  onPress={() => handleRequestRide()}
  variant="primary"
  size="medium"
/>
```

### Input

Componente de entrada de texto con validación.

**Ubicación**: `app/components/ui/Input.tsx`

**Props**:
- `placeholder` (string): Texto de placeholder
- `value` (string): Valor actual
- `onChangeText` (function): Callback al cambiar texto
- `secureTextEntry` (boolean): Ocultar texto (contraseña)
- `keyboardType` (string): Tipo de teclado
- `label` (string): Etiqueta del campo
- `error` (string): Mensaje de error
- `icon` (string): Nombre del icono
- `maxLength` (number): Longitud máxima
- `multiline` (boolean): Permitir múltiples líneas

**Ejemplo**:
```tsx
import { Input } from '@/components/ui';

<Input
  label="Correo electrónico"
  placeholder="tu@email.com"
  value={email}
  onChangeText={setEmail}
  keyboardType="email-address"
  icon="mail"
  error={emailError}
/>
```

### Card

Componente de tarjeta para agrupar contenido.

**Ubicación**: `app/components/ui/Card.tsx`

**Props**:
- `children` (ReactNode): Contenido de la tarjeta
- `shadow` ('sm' | 'md' | 'lg' | 'none'): Nivel de sombra
- `padding` ('sm' | 'md' | 'lg'): Espaciado interno
- `borderColor` (string): Color del borde
- `borderWidth` (number): Ancho del borde

**Ejemplo**:
```tsx
import { Card } from '@/components/ui';

<Card shadow="md" padding="lg">
  <Text>Contenido de la tarjeta</Text>
</Card>
```

### Logo

Componente del logo de UrbanTaxi.

**Ubicación**: `app/components/ui/Logo.tsx`

**Props**:
- `size` ('small' | 'medium' | 'large'): Tamaño del logo
- `showTagline` (boolean): Mostrar tagline
- `style` (ViewStyle): Estilos personalizados

**Ejemplo**:
```tsx
import { Logo } from '@/components/ui';

<Logo size="large" showTagline={true} />
```

---

## 🌍 Multiidioma (i18n)

### Configuración

El sistema de multiidioma usa **react-i18next** con detección automática del idioma del dispositivo.

**Ubicación de configuración**: `app/i18n/config.ts`

### Idiomas Soportados

- **Español** (es): `app/i18n/es.json`
- **Inglés** (en): `app/i18n/en.json`

### Uso

#### Hook personalizado

```tsx
import { useTranslation } from '@/hooks/useTranslation';

export const MyComponent = () => {
  const { t, changeLanguage, currentLanguage } = useTranslation();

  return (
    <View>
      <Text>{t('common.welcome')}</Text>
      <Button
        title={t('common.login')}
        onPress={() => changeLanguage('es')}
      />
    </View>
  );
};
```

#### Estructura de Traducciones

Las traducciones están organizadas por secciones:

```json
{
  "common": { ... },      // Textos comunes
  "auth": { ... },        // Autenticación
  "passenger": { ... },   // Pasajero
  "driver": { ... },      // Conductor
  "admin": { ... },       // Administrador
  "errors": { ... },      // Errores
  "validation": { ... }   // Validación
}
```

### Cambiar Idioma

```tsx
const { changeLanguage } = useTranslation();

// Cambiar a español
changeLanguage('es');

// Cambiar a inglés
changeLanguage('en');
```

### Agregar Nuevas Traducciones

1. Abrir `app/i18n/es.json` y `app/i18n/en.json`
2. Agregar la nueva clave en ambos archivos
3. Usar en componentes con `t('clave.nueva')`

**Ejemplo**:
```json
// es.json
{
  "new_section": {
    "new_key": "Nuevo texto en español"
  }
}

// en.json
{
  "new_section": {
    "new_key": "New text in English"
  }
}
```

---

## 📐 Espaciado

```typescript
xs: 4px
sm: 8px
md: 16px
lg: 24px
xl: 32px
xxl: 48px
```

---

## 🔲 Border Radius

```typescript
sm: 8px
md: 16px
lg: 24px
full: 9999px (circular)
```

---

## 🌟 Sombras

### Small
```typescript
shadowColor: '#000'
shadowOffset: { width: 0, height: 1 }
shadowOpacity: 0.1
shadowRadius: 2
elevation: 2
```

### Medium
```typescript
shadowColor: '#000'
shadowOffset: { width: 0, height: 2 }
shadowOpacity: 0.15
shadowRadius: 4
elevation: 4
```

### Large
```typescript
shadowColor: '#000'
shadowOffset: { width: 0, height: 4 }
shadowOpacity: 0.2
shadowRadius: 8
elevation: 8
```

---

## 📦 Importar Componentes

```tsx
// Importar componentes individuales
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';

// O importar desde el índice
import { Button, Input, Card, Logo } from '@/components/ui';
```

---

## 🎨 Importar Tema

```tsx
import { Theme, Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';

// Usar colores
const primaryColor = Colors.primary; // #2FB908

// Usar tipografía
const headingStyle = Typography.h1;

// Usar espaciado
const padding = Spacing.md; // 16px

// Usar border radius
const radius = BorderRadius.md; // 16px
```

---

## ✅ Checklist de Implementación

- [x] Paleta de colores definida
- [x] Tipografía configurada
- [x] Componente Button creado
- [x] Componente Input creado
- [x] Componente Card creado
- [x] Componente Logo creado
- [x] i18n configurado
- [x] Traducciones en español
- [x] Traducciones en inglés
- [x] Hook useTranslation creado
- [x] Detección automática de idioma

---

## 📚 Referencias

- **Colores**: `app/constants/theme.ts`
- **Componentes**: `app/components/ui/`
- **Traducciones**: `app/i18n/`
- **Hooks**: `app/hooks/useTranslation.ts`

