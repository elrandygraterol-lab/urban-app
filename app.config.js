module.exports = ({ config }) => {
  return {
    ...config,
    name: 'UrbanTaxis',
    slug: 'app-taxis',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'apptaxis',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.urbantaxi.passenger',
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'UrbanTaxi necesita acceso a tu ubicación para mostrarte en el mapa y solicitar viajes.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'UrbanTaxi necesita acceso a tu ubicación para mostrarte en el mapa y solicitar viajes.',
      },
      config: {
        googleMapsApiKey: 'AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU',
      },
    },
    android: {
      package: 'com.urbantaxi.passenger',
      googleServicesFile: './google-services.json',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'FOREGROUND_SERVICE',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
      config: {
        googleMaps: {
          apiKey: 'AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU',
        },
      },
    },
    plugins: [
      'expo-router',
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: true,
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
            'UrbanTaxi necesita acceso a tu ubicación para mostrarte en el mapa y solicitar viajes.',
          locationWhenInUsePermission:
            'UrbanTaxi necesita acceso a tu ubicación para mostrarte en el mapa y solicitar viajes.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/images/icon.png',
          color: '#22c55e',
          sounds: ['./assets/sounds/notification.wav'],
          androidCollapsedTitle: 'UrbanTaxi',
        },
      ],
      '@react-native-firebase/app',
      'expo-audio',
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
    assetBundlePatterns: ['**/*'],
    extra: {
      router: {},
      eas: {
      projectId:'f454393f-392d-435f-afd1-492ae42a4a20',
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
