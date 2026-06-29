module.exports = ({ config }) => {
  return {
    ...config,
    name: 'UrbanTaxi SJ',
    slug: 'app-taxis',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'apptaxis',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.urbantaxi.app',
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'UrbanTaxi SJ necesita acceso a tu ubicación para mostrarte en el mapa, encontrar conductores cercanos, calcular tarifas y rutas.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'UrbanTaxi SJ necesita acceso a tu ubicación incluso en segundo plano para compartir tu posición en tiempo real con el conductor durante el viaje y con el pasajero cuando conducas, garantizando un servicio seguro y preciso.',
        UIBackgroundModes: ['location', 'fetch', 'remote-notification'],
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      package: 'com.urbantaxi.app',
      googleServicesFile: './google-services.json',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
      },
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION',
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    plugins: [
      [
        'expo-router',
        {
          asyncRoutes: true,
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            minSdkVersion: 24,
            usesCleartextTraffic: process.env.NODE_ENV !== 'production',
          },
        },
      ],
      './plugins/withGoogleMapsApiKey',
      'expo-web-browser',
      'expo-asset',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'UrbanTaxi SJ necesita acceso a tu ubicación incluso en segundo plano para compartir tu posición en tiempo real con el conductor durante el viaje y con el pasajero cuando conducas, garantizando un servicio seguro y preciso.',
          locationWhenInUsePermission:
            'UrbanTaxi SJ necesita acceso a tu ubicación para mostrarte en el mapa, encontrar conductores cercanos, calcular tarifas y rutas.',
          isAndroidBackgroundLocationEnabled: true,
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/images/icon.png',
          color: '#22c55e',
          androidCollapsedTitle: 'UrbanTaxi SJ',
        },
      ],
      '@react-native-firebase/app',
      'expo-audio',
      './plugins/withRemoveRecordAudioPermission',
    ],
    experiments: {
      typedRoutes: true,
    },
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    updates: {
      fallbackToCacheTimeout: 0,
    },
    privacyPolicyUrl: 'https://administracionurbantaxis.com/privacidad',
    assetBundlePatterns: ['**/*'],
    extra: {
      router: {},
      eas: {
      projectId:'d5d00c82-5977-4eca-9535-22c8b356cb71',
      },
      // Store Management System Configuration
      storeImageMaxSizeMB: 5,
      storeMaxLogoImages: 1,
      storeMaxPhotoImages: 10,
      storeDefaultSearchRadiusKm: 50,
      storeMaxSearchRadiusKm: 100,
    },
  };
};
