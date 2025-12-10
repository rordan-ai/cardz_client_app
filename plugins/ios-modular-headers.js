// Config plugin to fix Firebase modular headers with New Architecture
// Adds use_modular_headers! globally and fixes CLANG settings
const { withPodfile } = require('@expo/config-plugins');

function withModularHeadersFix(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;

    // 1. Add use_modular_headers! globally if not present
    if (!contents.includes('use_modular_headers!')) {
      // Insert after platform :ios line
      const platformRegex = /(platform :ios, ['"][\d.]+['"])/;
      if (platformRegex.test(contents)) {
        contents = contents.replace(platformRegex, `$1\nuse_modular_headers!`);
        console.log('[ios-modular-headers] Added use_modular_headers! globally');
      }
    }

    // 2. Add CLANG fix to post_install block
    if (!contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
      // The code to inject - must be properly indented Ruby code
      const fixCode = `
    # Fix for Firebase modular headers with New Architecture (added by ios-modular-headers plugin)
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
`;

      // Find the post_install block and inject our code right after the opening
      const postInstallRegex = /(post_install\s+do\s+\|installer\|\s*\n)/;
      
      if (postInstallRegex.test(contents)) {
        contents = contents.replace(postInstallRegex, `$1${fixCode}`);
        console.log('[ios-modular-headers] Added CLANG_ALLOW_NON_MODULAR_INCLUDES fix');
      } else {
        console.log('[ios-modular-headers] WARNING: Could not find post_install block');
      }
    }

    // 3. Add modular_headers: true for specific Firebase-related pods
    // This ensures React Native headers are accessible to Firebase
    if (!contents.includes("pod 'React-Core', :modular_headers => true")) {
      const targetRegex = /(target\s+['"].*['"]\s+do)/;
      if (targetRegex.test(contents)) {
        const modularPodsFix = `
  # Modular headers for Firebase compatibility (added by ios-modular-headers plugin)
  pod 'React-Core', :modular_headers => true
  pod 'React-RCTFabric', :modular_headers => true
`;
        contents = contents.replace(targetRegex, `$1${modularPodsFix}`);
        console.log('[ios-modular-headers] Added modular_headers for React pods');
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withModularHeadersFix;
