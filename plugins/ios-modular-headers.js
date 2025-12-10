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

    // 2. Add CLANG fix to post_install block (this is the main fix for Firebase + New Architecture)
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

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withModularHeadersFix;
