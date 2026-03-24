const { withAndroidManifest } = require('@expo/config-plugins');

const withGoogleMapsApiKey = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];

    // Check if API key already exists
    const existingMetaData = application['meta-data'] || [];
    const hasApiKey = existingMetaData.some(
      (item) => item.$['android:name'] === 'com.google.android.geo.API_KEY'
    );

    if (!hasApiKey) {
      // Add Google Maps API Key
      if (!application['meta-data']) {
        application['meta-data'] = [];
      }

      application['meta-data'].push({
        $: {
          'android:name': 'com.google.android.geo.API_KEY',
          'android:value': 'AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU',
        },
      });

      console.log('✅ Google Maps API Key inyectada en AndroidManifest.xml');
    } else {
      console.log('✅ Google Maps API Key ya existe en AndroidManifest.xml');
    }

    return config;
  });
};

module.exports = withGoogleMapsApiKey;
