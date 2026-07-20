module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const appName = profile === 'production' ? 'UrbanTaxi SJ'
    : profile === 'preview' ? 'UrbanTaxi PP'
    : 'UrbanTaxi D';
  const suffix = profile === 'production' ? ''
    : profile === 'preview' ? '.preview'
    : '.dev';
  const packageName = `com.urbantaxi.app${suffix}`;
  const isFirebaseEnabled = profile === 'production';

  return {
    ...config,
    name: appName,
    slug: 'app-taxis',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'apptaxis',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      bundleIdentifier: packageName,
      googleServicesFile: isFirebaseEnabled ? './GoogleService-Info.plist' : undefined,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          `${appName} necesita acceso a tu ubicación para mostrarte en el mapa, encontrar conductores cercanos, calcular tarifas y rutas.`,
        NSLocationAlwaysAndWhenInUseUsageDescription:
          `${appName} necesita acceso a tu ubicación incluso en segundo plano para compartir tu posición en tiempo real con el conductor durante el viaje y con el pasajero cuando conducas, garantizando un servicio seguro y preciso.`,
        UIBackgroundModes: ['location', 'fetch', 'remote-notification'],
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      versionCode: 11,
      package: packageName,
      googleServicesFile: isFirebaseEnabled ? './google-services.json' : undefined,
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
      },
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
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
            `${appName} necesita acceso a tu ubicación incluso en segundo plano para compartir tu posición en tiempo real con el conductor durante el viaje y con el pasajero cuando conducas, garantizando un servicio seguro y preciso.`,
          locationWhenInUsePermission:
            `${appName} necesita acceso a tu ubicación para mostrarte en el mapa, encontrar conductores cercanos, calcular tarifas y rutas.`,
          isAndroidBackgroundLocationEnabled: true,
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/images/icon.png',
          color: '#22c55e',
          androidCollapsedTitle: appName,
        },
      ],
      ...(isFirebaseEnabled ? ['@react-native-firebase/app'] : []),
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
    assetBundlePatterns: ['assets/**/*'],
    extra: {
      router: {},
      eas: {
      projectId:'30ef3cd5-fa02-47c3-9994-c57eeb7860be',
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
