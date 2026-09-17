const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withReactNativeMapsFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.projectRoot, 'ios', 'Podfile');
      
      if (fs.existsSync(podfilePath)) {
        let podfile = fs.readFileSync(podfilePath, 'utf-8');
        
        // Fix for react-native-maps non-modular header issue with Xcode 16
        // Insert inside existing post_install block
        const fixCode = `
    # Fix for react-native-maps non-modular header issue with Xcode 16
    installer.pods_project.targets.each do |target|
      if target.name == 'react_native_maps' || target.name == 'React-Core'
        target.build_configurations.each do |config|
          config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'
          config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
        end
      end
    end
`;
        
        // Find the existing post_install block and insert before its closing 'end'
        if (!podfile.includes('CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE')) {
          // Match: post_install do |installer| ... end (the last end of that block)
          podfile = podfile.replace(
            /(post_install do \|installer\|.*?)(\s+end\s*\n)/m,
            '$1' + fixCode + '$2'
          );
          fs.writeFileSync(podfilePath, podfile);
          console.log('✅ Added react-native-maps fix to Podfile post_install block');
        }
      }
      
      return config;
    },
  ]);
};