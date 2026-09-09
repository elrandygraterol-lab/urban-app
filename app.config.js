module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const appName = profile === 'production' ? 'UrbanTaxi SJ'
    : profile === 'preview' ? 'UrbanTaxi PP'
    : 'UrbanTaxi D';
  const suffix = profile === 'production' ? ''
    : profile === 'preview' ? '.preview'
    : '.dev';
  const packageName = `com.urbantaxi.app${suffix}`;
  const androidGoogleServices = profile === 'production' ? './google-services.json'
    : profile === 'preview' ? './google-services-preview.json'
    : './google-services-dev.json';
  const iosGoogleServices = profile === 'production' ? './GoogleService-Info.plist'
    : profile === 'preview' ? './GoogleService-Info-preview.plist'
    : './GoogleService-Info.plist'; // dev builds: use production plist as fallback

  return {
    ...config,
    name: appName,
    slug: 'app-taxis',
    version: '1.0.0',

    icon: './assets/images/icon.png',
    scheme: 'apptaxis',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      bundleIdentifier: packageName,
      googleServicesFile: iosGoogleServices,
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
      versionCode: 17,
      package: packageName,
      googleServicesFile: androidGoogleServices,
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
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            minSdkVersion: 24,
            usesCleartextTraffic: process.env.NODE_ENV !== 'production',
          },
        },
      ],
      './plugins/withGoogleMapsApiKey',
      'expo-web-browser',
      'expo-localization',
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
          icon: './assets/images/notification-icon.png',
          color: '#ffffff',
          androidCollapsedTitle: appName,
        },
      ],
      '@react-native-firebase/app',
      'expo-audio',
      './plugins/withRemoveRecordAudioPermission',
      './plugins/withEdgeToEdge',
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
        "projectId": "358c0fe7-fd50-41a0-befd-86213bed1fbf"
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
