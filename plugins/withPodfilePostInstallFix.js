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
        const postInstallFix = `
    # Fix for react-native-maps non-modular header issue with Xcode 16 / iOS 18 SDK
    installer.pods_project.targets.each do |target|
      if target.name == 'react_native_maps' || target.name == 'React-Core'
        target.build_configurations.each do |config|
          config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'
          config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
        end
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