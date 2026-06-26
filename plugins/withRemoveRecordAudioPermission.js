const { withAndroidManifest } = require('expo/config-plugins');

function removeRecordAudioPermission(androidManifest) {
  const permissions = androidManifest['manifest']['uses-permission'] || [];
  androidManifest['manifest']['uses-permission'] = permissions.filter(
    (perm) =>
      perm['$']['android:name'] !== 'android.permission.RECORD_AUDIO'
  );
  return androidManifest;
}

module.exports = function withRemoveRecordAudioPermission(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = removeRecordAudioPermission(config.modResults);
    return config;
  });
};
