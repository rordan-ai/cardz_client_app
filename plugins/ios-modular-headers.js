// Config plugin to fix Firebase modular headers with New Architecture
// Based on official rnfirebase.io documentation
const { withPodfile } = require('@expo/config-plugins');

function withModularHeadersFix(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;

    // 1. Add $RNFirebaseAsStaticFramework = true (REQUIRED for static frameworks)
    // This must be at the top of the Podfile, before use_frameworks!
    if (!contents.includes('$RNFirebaseAsStaticFramework')) {
      // Insert after platform :ios line
      const platformRegex = /(platform :ios, ['"][\d.]+['"])/;
      if (platformRegex.test(contents)) {
        contents = contents.replace(
          platformRegex, 
          `$1\n\n# Required for React Native Firebase with static frameworks\n$RNFirebaseAsStaticFramework = true`
        );
        console.log('[ios-modular-headers] Added $RNFirebaseAsStaticFramework = true');
      }
    }

    // 2. Add use_modular_headers! globally if not present
    if (!contents.includes('use_modular_headers!')) {
      // Insert after the $RNFirebaseAsStaticFramework line or after platform
      if (contents.includes('$RNFirebaseAsStaticFramework = true')) {
        contents = contents.replace(
          '$RNFirebaseAsStaticFramework = true',
          '$RNFirebaseAsStaticFramework = true\nuse_modular_headers!'
        );
      } else {
        const platformRegex = /(platform :ios, ['"][\d.]+['"])/;
        if (platformRegex.test(contents)) {
          contents = contents.replace(platformRegex, `$1\nuse_modular_headers!`);
        }
      }
      console.log('[ios-modular-headers] Added use_modular_headers! globally');
    }

    // 3. Add CLANG fix to post_install block (for New Architecture compatibility)
    if (!contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
      const fixCode = `
    # Fix for Firebase modular headers with New Architecture (added by ios-modular-headers plugin)
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
`;

      const postInstallRegex = /(post_install\s+do\s+\|installer\|\s*\n)/;
      
      if (postInstallRegex.test(contents)) {
        contents = contents.replace(postInstallRegex, `$1${fixCode}`);
        console.log('[ios-modular-headers] Added CLANG_ALLOW_NON_MODULAR_INCLUDES fix');
      } else {
        console.log('[ios-modular-headers] WARNING: Could not find post_install block');
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withModularHeadersFix;
