// Config plugin to fix Firebase modular headers with New Architecture
// Combines withPodfile (for use_modular_headers!) and withDangerousMod (for post_install modifications)
const { withPodfile } = require('@expo/config-plugins');

function withModularHeadersFix(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;

    // 1. Add use_modular_headers! if not present
    if (!contents.includes('use_modular_headers!')) {
      // Add after platform line
      contents = contents.replace(
        /(platform :ios.*\n)/,
        `$1use_modular_headers!\n`
      );
      console.log('[ios-modular-headers] Added use_modular_headers!');
    }

    // 2. Add CLANG_ALLOW_NON_MODULAR_INCLUDES fix to post_install
    const modularHeadersFix = `
    # Fix for Firebase modular headers with New Architecture
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
`;

    if (!contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
      // Find post_install and add our code inside it
      const postInstallMatch = contents.match(/post_install\s+do\s+\|installer\|/);
      
      if (postInstallMatch) {
        contents = contents.replace(
          /(post_install\s+do\s+\|installer\|)/,
          `$1${modularHeadersFix}`
        );
        console.log('[ios-modular-headers] Added CLANG_ALLOW_NON_MODULAR_INCLUDES fix to post_install');
      } else {
        // If no post_install exists, add one before the final 'end'
        contents = contents.replace(
          /(\nend\s*)$/,
          `
  post_install do |installer|${modularHeadersFix}  end
$1`
        );
        console.log('[ios-modular-headers] Created new post_install with CLANG fix');
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withModularHeadersFix;
