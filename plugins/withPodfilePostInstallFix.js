const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withPodfilePostInstallFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.projectRoot, 'ios', 'Podfile');
      
      if (fs.existsSync(podfilePath)) {
        let podfile = fs.readFileSync(podfilePath, 'utf-8');
        
        // Fix for react-native-maps non-modular header issue with Xcode 16 / iOS 18 SDK
        // Applied to all pod targets: the react-native-maps pod target is named
        // 'react-native-maps' (dash), not 'react_native_maps' (underscore), so a
        // name-scoped check never matches and leaves -Werror=non-modular... on.
        const postInstallFix = `
    # Fix for react-native-maps / react-native-google-maps non-modular header
    # issue with Xcode 16 / iOS 18 SDK and new architecture (modules).
    # 1) Disable non-modular-include escalation and other warnings for every pod.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
      end
    end
    # 2) The Google provider target includes AirMaps headers through the
    #    react_native_maps module; ordering the superclass import fails with
    #    "declaration of 'RCTViewManager' must be imported from module". Turn
    #    clang modules OFF only for the google provider target so those headers
    #    become textual includes. (react-native-maps keeps modules ON so the app
    #    can still import it as a framework module.)
    installer.pods_project.targets.each do |target|
      next unless target.name.include?('react-native-google-maps')
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ENABLE_MODULES'] = 'NO'
      end
    end
`;
        
        // Insert into existing post_install block - find the end of the post_install block
        if (!podfile.includes('CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE')) {
          // Find: post_install do |installer| ... end\nend
          // The post_install block ends with "  end\nend" (two ends)
          const regex = /(post_install do \|installer\|[\s\S]*?)(\s+end\s*\n\s*end)/;
          const match = podfile.match(regex);
          
          if (match) {
            podfile = podfile.replace(regex, '$1' + postInstallFix + '$2');
            fs.writeFileSync(podfilePath, podfile);
            console.log('✅ Added react-native-maps Xcode 16 fix to Podfile post_install');
          } else {
            console.log('⚠️ Could not find post_install block to patch');
          }
        }
      }
      
      return config;
    },
  ]);
};

module.exports = withPodfilePostInstallFix;