# Stack Tecnológico - Expo + React Native

Guía completa para crear una aplicación móvil usando el mismo stack tecnológico.

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Inicialización del Proyecto](#inicialización-del-proyecto)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Dependencias Principales](#dependencias-principales)
5. [Configuración](#configuración)
6. [Desarrollo](#desarrollo)
7. [Testing](#testing)
8. [Build y Deploy](#build-y-deploy)

---

## 🔧 Requisitos Previos

### Software Necesario

```bash
# Node.js (versión 18 o superior)
node --version

# npm o yarn
npm --version

# Expo CLI
npm install -g expo-cli

# EAS CLI (para builds)
npm install -g eas-cli
```

### Cuentas Necesarias

- Cuenta de Expo: https://expo.dev
- Cuenta de Google Cloud (para Google Maps API)
- Cuenta de Apple Developer (para iOS)
- Cuenta de Google Play Console (para Android)

---

## 🚀 Inicialización del Proyecto

### 1. Crear Proyecto con Expo Router

```bash
# Crear nuevo proyecto
npx create-expo-app@latest mi-app --template tabs

# Navegar al directorio
cd mi-app

# Instalar Expo Router
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
```

### 2. Configurar TypeScript

```bash
# Instalar TypeScript
npm install --save-dev typescript @types/react @types/react-native

# Crear tsconfig.json
npx tsc --init
```

**tsconfig.json:**
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

---

## 📁 Estructura del Proyecto

```
mi-app/
├── app/                          # Rutas de la aplicación (Expo Router)
│   ├── (auth)/                   # Grupo de rutas de autenticación
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── _layout.tsx
│   ├── (tabs)/                   # Grupo de rutas con tabs
│   │   ├── index.tsx
│   │   ├── profile.tsx
│   │   └── _layout.tsx
│   ├── _layout.tsx               # Layout raíz
│   └── modal.tsx
├── assets/                       # Recursos estáticos
│   ├── images/
│   └── sounds/
├── components/                   # Componentes reutilizables
│   ├── ui/                       # Componentes UI básicos
│   └── ErrorBoundary.tsx
├── constants/                    # Constantes y configuración
│   ├── colors.ts
│   └── theme.ts
├── hooks/                        # Custom hooks
│   ├── useColorScheme.ts
│   └── useNotifications.ts
├── i18n/                         # Internacionalización
│   ├── config.ts
│   ├── en.json
│   └── es.json
├── services/                     # Servicios (API, Socket, etc.)
│   ├── api.ts
│   └── socket.ts
├── store/                        # Estado global (Zustand)
│   ├── authStore.ts
│   └── notificationStore.ts
├── utils/                        # Utilidades
│   └── errorLogger.ts
├── app.config.js                 # Configuración de Expo
├── package.json
└── tsconfig.json
```

---


## 📦 Dependencias Principales

### Instalación de Dependencias Core

```bash
# Navegación y Routing
npx expo install expo-router react-native-safe-area-context react-native-screens
npx expo install @react-navigation/native @react-navigation/bottom-tabs

# Estado Global
npm install zustand

# Validación de Datos
npm install zod

# HTTP Client
npm install axios

# WebSocket
npm install socket.io-client

# Almacenamiento
npx expo install @react-native-async-storage/async-storage expo-secure-store

# Ubicación y Mapas
npx expo install expo-location react-native-maps

# Notificaciones
npx expo install expo-notifications

# Imágenes y Archivos
npx expo install expo-image-picker expo-file-system expo-image

# UI y Animaciones
npx expo install react-native-reanimated react-native-gesture-handler
npx expo install expo-haptics expo-linear-gradient

# Internacionalización
npm install i18next react-i18next expo-localization

# Formularios
npm install react-hook-form

# Utilidades
npx expo install expo-linking expo-web-browser expo-constants
npx expo install react-native-keyboard-aware-scroll-view
```

### Dependencias de Desarrollo

```bash
# Testing
npm install --save-dev jest @testing-library/react-native @testing-library/jest-dom
npm install --save-dev @types/jest ts-jest react-test-renderer
npm install --save-dev fast-check  # Property-based testing

# Linting y Formatting
npm install --save-dev eslint eslint-config-expo
npm install --save-dev prettier eslint-config-prettier eslint-plugin-prettier

# TypeScript
npm install --save-dev typescript @types/react @types/react-native

# Build Tools
npm install --save-dev expo-dev-client
```

---

## ⚙️ Configuración

### 1. app.config.js

```javascript
module.exports = ({ config }) => {
  return {
    ...config,
    name: "mi-app",
    slug: "mi-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "miapp",
    userInterfaceStyle: "automatic",
    
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.miempresa.miapp",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Necesitamos tu ubicación para...",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Necesitamos tu ubicación para..."
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
      }
    },
    
    android: {
      package: "com.miempresa.miapp",
      adaptiveIcon: {
        backgroundColor: "#FFFFFF",
        foregroundImage: "./assets/images/android-icon-foreground.png"
      },
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY
        }
      }
    },
    
    plugins: [
      "expo-router",
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Necesitamos tu ubicación para..."
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/icon.png",
          color: "#22c55e"
        }
      ]
    ],
    
    experiments: {
      typedRoutes: true
    },
    
    extra: {
      eas: {
        projectId: "tu-project-id"
      }
    }
  };
};
```

### 2. .env (Variables de Entorno)

```bash
# API
API_URL=https://api.miapp.com
API_TIMEOUT=30000

# Google Maps
GOOGLE_MAPS_API_KEY=tu-api-key

# Socket
SOCKET_URL=https://socket.miapp.com

# Otros
APP_ENV=development
```

### 3. package.json Scripts

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "lint": "expo lint",
    "format": "prettier --write \"**/*.{js,jsx,ts,tsx,json,md}\"",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "prebuild": "expo prebuild --clean",
    "build:android": "eas build --platform android --profile development",
    "build:ios": "eas build --platform ios --profile development"
  }
}
```

---

## 🛠️ Desarrollo

### 1. Configurar Zustand (Estado Global)

**store/authStore.ts:**
```typescript
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  
  setAuth: (user, token) => {
    set({ user, token, isAuthenticated: true });
    AsyncStorage.setItem('auth_token', token);
    AsyncStorage.setItem('user', JSON.stringify(user));
  },
  
  logout: () => {
    set({ user: null, token: null, isAuthenticated: false });
    AsyncStorage.removeItem('auth_token');
    AsyncStorage.removeItem('user');
  },
  
  loadStoredAuth: async () => {
    const token = await AsyncStorage.getItem('auth_token');
    const userStr = await AsyncStorage.getItem('user');
    
    if (token && userStr) {
      const user = JSON.parse(userStr);
      set({ user, token, isAuthenticated: true });
    }
  },
}));
```

### 2. Configurar API Service

**services/api.ts:**
```typescript
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const API_URL = process.env.API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (data: any) =>
    api.post('/auth/register', data),
};

export default api;
```

### 3. Configurar Socket.IO

**services/socket.ts:**
```typescript
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export const connectSocket = async (token: string): Promise<Socket> => {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  return new Promise((resolve, reject) => {
    socket!.on('connect', () => {
      console.log('Socket connected:', socket!.id);
      resolve(socket!);
    });

    socket!.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      reject(error);
    });
  });
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
```

### 4. Configurar Notificaciones Globales

**store/notificationStore.ts:**
```typescript
import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
}

interface NotificationStore {
  currentNotification: Notification | null;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  dismissCurrentNotification: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  currentNotification: null,

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    set({ currentNotification: newNotification });

    // Auto-dismiss después de 5 segundos
    setTimeout(() => {
      const current = get().currentNotification;
      if (current?.id === newNotification.id) {
        get().dismissCurrentNotification();
      }
    }, 5000);
  },

  dismissCurrentNotification: () => {
    set({ currentNotification: null });
  },
}));
```

**components/GlobalNotificationModal.tsx:**
```typescript
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore } from '@/store/notificationStore';

export const GlobalNotificationModal: React.FC = () => {
  const { currentNotification, dismissCurrentNotification } = useNotificationStore();
  const slideAnim = React.useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    if (currentNotification) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [currentNotification]);

  if (!currentNotification) return null;

  return (
    <Modal visible={true} transparent={true} animationType="none">
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.notificationCard,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text style={styles.title}>{currentNotification.title}</Text>
          <Text style={styles.message}>{currentNotification.message}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#505050',
  },
});
```

### 5. Configurar Internacionalización

**i18n/config.ts:**
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './en.json';
import es from './es.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: Localization.locale.split('-')[0],
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

**i18n/es.json:**
```json
{
  "welcome": "Bienvenido",
  "login": "Iniciar Sesión",
  "register": "Registrarse",
  "email": "Correo Electrónico",
  "password": "Contraseña"
}
```

---

### 6. Configurar Expo Router

**app/_layout.tsx:**
```typescript
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { GlobalNotificationModal } from '@/components/GlobalNotificationModal';

export default function RootLayout() {
  const { isAuthenticated, loadStoredAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    loadStoredAuth();
  }, []);

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="auto" />
      <GlobalNotificationModal />
    </>
  );
}
```

**app/(auth)/_layout.tsx:**
```typescript
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
```

**app/(tabs)/_layout.tsx:**
```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

### 7. Crear Componentes UI Reutilizables

**components/ui/Button.tsx:**
```typescript
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#6b7280',
  },
  buttonDisabled: {
    backgroundColor: '#d1d5db',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

**components/ui/Input.tsx:**
```typescript
import React from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
}) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
});
```

---

## 🧪 Testing

### 1. Configurar Jest

**jest.config.js:**
```javascript
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/coverage/**',
    '!**/node_modules/**',
    '!**/.expo/**',
  ],
};
```

**jest.setup.js:**
```javascript
import '@testing-library/jest-dom';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Expo modules
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useSegments: () => [],
}));
```

### 2. Escribir Tests

**__tests__/components/Button.test.tsx:**
```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui/Button';

describe('Button Component', () => {
  it('renders correctly', () => {
    const { getByText } = render(
      <Button title="Click Me" onPress={() => {}} />
    );
    expect(getByText('Click Me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button title="Click Me" onPress={onPress} />
    );
    
    fireEvent.press(getByText('Click Me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows loading indicator when loading', () => {
    const { getByTestId } = render(
      <Button title="Click Me" onPress={() => {}} loading={true} />
    );
    expect(getByTestId('activity-indicator')).toBeTruthy();
  });
});
```

### 3. Property-Based Testing con Fast-Check

```typescript
import * as fc from 'fast-check';
import { validateEmail } from '@/utils/validation';

describe('Email Validation', () => {
  it('should validate email format', () => {
    fc.assert(
      fc.property(
        fc.emailAddress(),
        (email) => {
          expect(validateEmail(email)).toBe(true);
        }
      )
    );
  });
});
```

---

## 📱 Build y Deploy

### 1. Configurar EAS (Expo Application Services)

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login en Expo
eas login

# Configurar proyecto
eas build:configure
```

**eas.json:**
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

### 2. Build para Desarrollo

```bash
# Android
eas build --platform android --profile development

# iOS
eas build --platform ios --profile development

# Ambos
eas build --platform all --profile development
```

### 3. Build para Producción

```bash
# Android (AAB para Play Store)
eas build --platform android --profile production

# iOS (para App Store)
eas build --platform ios --profile production
```

### 4. Submit a Stores

```bash
# Android
eas submit --platform android

# iOS
eas submit --platform ios
```

---

## 🎨 Mejores Prácticas

### 1. Estructura de Código

- **Componentes pequeños y reutilizables**
- **Separación de lógica y presentación**
- **Custom hooks para lógica compartida**
- **Tipos TypeScript estrictos**

### 2. Manejo de Estado

- **Zustand para estado global**
- **useState para estado local**
- **React Query para datos del servidor** (opcional)

### 3. Manejo de Errores

```typescript
// utils/errorLogger.ts
export const logError = (
  component: string,
  error: any,
  context?: Record<string, any>
) => {
  console.error(`[${component}]`, error, context);
  
  // En producción, enviar a servicio de monitoreo
  if (process.env.NODE_ENV === 'production') {
    // Sentry, Bugsnag, etc.
  }
};
```

**Regla de Oro:** No mostrar errores técnicos al usuario, solo logs en consola.

### 4. Performance

```typescript
// Usar React.memo para componentes pesados
export const HeavyComponent = React.memo(({ data }) => {
  return <View>{/* ... */}</View>;
});

// Usar useCallback para funciones
const handlePress = useCallback(() => {
  // ...
}, [dependencies]);

// Usar useMemo para cálculos costosos
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);
```

### 5. Seguridad

```typescript
// Nunca guardar datos sensibles en AsyncStorage sin encriptar
import * as SecureStore from 'expo-secure-store';

// Guardar token de forma segura
await SecureStore.setItemAsync('auth_token', token);

// Leer token
const token = await SecureStore.getItemAsync('auth_token');
```

---

## 🔍 Debugging

### 1. React Native Debugger

```bash
# Instalar
brew install --cask react-native-debugger

# Usar
# Presionar Cmd+D (iOS) o Cmd+M (Android) en el simulador
# Seleccionar "Debug"
```

### 2. Flipper

```bash
# Instalar
brew install --cask flipper

# Usar con desarrollo client
npx expo run:ios
npx expo run:android
```

### 3. Logs

```typescript
// Usar console.log con prefijos
console.log('[ComponentName]', 'Message', data);

// Usar logError para errores
logError('ComponentName', error, { context: 'Operation' });
```

---

## 📚 Recursos Adicionales

### Documentación Oficial

- **Expo:** https://docs.expo.dev
- **React Native:** https://reactnative.dev
- **Expo Router:** https://expo.github.io/router
- **Zustand:** https://zustand-demo.pmnd.rs

### Herramientas Útiles

- **React Native Directory:** https://reactnative.directory
- **Expo Snack:** https://snack.expo.dev (playground online)
- **Can I Use:** https://caniuse.com (compatibilidad web)

### Comunidad

- **Expo Discord:** https://chat.expo.dev
- **React Native Community:** https://www.reactnative.dev/community/overview
- **Stack Overflow:** Tag `expo` o `react-native`

---

## 🚀 Comandos Rápidos

```bash
# Desarrollo
npm start                    # Iniciar Metro bundler
npm run android             # Correr en Android
npm run ios                 # Correr en iOS

# Testing
npm test                    # Correr tests
npm run test:watch          # Tests en modo watch
npm run test:coverage       # Coverage report

# Linting y Formatting
npm run lint                # Lint código
npm run format              # Formatear código

# Build
npm run prebuild            # Generar carpetas nativas
eas build --platform android --profile development
eas build --platform ios --profile development

# Deploy
eas submit --platform android
eas submit --platform ios
```

---

## ✅ Checklist de Inicio

- [ ] Instalar Node.js y npm
- [ ] Instalar Expo CLI y EAS CLI
- [ ] Crear cuenta en Expo
- [ ] Crear proyecto con Expo Router
- [ ] Configurar TypeScript
- [ ] Instalar dependencias principales
- [ ] Configurar app.config.js
- [ ] Crear estructura de carpetas
- [ ] Configurar Zustand stores
- [ ] Configurar servicios (API, Socket)
- [ ] Configurar i18n
- [ ] Crear componentes UI base
- [ ] Configurar testing
- [ ] Configurar EAS
- [ ] Probar en simulador/dispositivo

---

## 🎯 Próximos Pasos

1. **Definir la arquitectura de tu app**
2. **Crear mockups/wireframes**
3. **Implementar autenticación**
4. **Desarrollar features principales**
5. **Agregar tests**
6. **Optimizar performance**
7. **Preparar para producción**
8. **Deploy a stores**

---

**¡Listo para empezar! 🚀**

Este stack te proporciona todo lo necesario para crear una aplicación móvil moderna, escalable y profesional con React Native y Expo.
