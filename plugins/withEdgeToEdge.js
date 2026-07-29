const { withAndroidStyles } = require('@expo/config-plugins');

module.exports = function withEdgeToEdge(config) {
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults;

    let appTheme = styles.resources.style.find(
      (s) => s.$.name === 'AppTheme'
    );

    if (!appTheme) {
      appTheme = {
        $: { name: 'AppTheme', parent: 'Theme.AppCompat.DayNight.NoActionBar' },
        item: [],
      };
      styles.resources.style.push(appTheme);
    }

    const attrs = [
      { name: 'android:windowTranslucentStatus', _: 'true' },
      { name: 'android:windowTranslucentNavigation', _: 'true' },
    ];

    for (const attr of attrs) {
      const exists = appTheme.item.some(
        (i) => i.$ && i.$.name === attr.name
      );
      if (!exists) {
        appTheme.item.push({ $: { name: attr.name }, _: attr._ });
      }
    }

    return config;
  });
};
