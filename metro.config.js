const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Reduce parallel file operations to prevent EMFILE on Windows
config.maxWorkers = 2;

// Exclude react-native-maps on web platform
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    // Return a mock module for web
    return {
      type: 'empty',
    };
  }

  // Use default resolution for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
