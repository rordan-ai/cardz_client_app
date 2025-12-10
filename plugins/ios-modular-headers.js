// Config plugin to fix Firebase modular headers with New Architecture
// Properly injects code INSIDE the post_install block
const { withPodfile } = require('@expo/config-plugins');

function withModularHeadersFix(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;

    // Check if our fix is already present
    if (contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
      console.log('[ios-modular-headers] Fix already present, skipping');
      return config;
    }

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
    // Pattern: post_install do |installer| followed by newline and some content
    // We need to add our code after the first line of the block
    
    // Look for the pattern and add after "post_install do |installer|" + first newline
    const postInstallRegex = /(post_install\s+do\s+\|installer\|\s*\n)/;
    
    if (postInstallRegex.test(contents)) {
      contents = contents.replace(postInstallRegex, `$1${fixCode}`);
      console.log('[ios-modular-headers] Successfully injected CLANG fix into post_install');
    } else {
      console.log('[ios-modular-headers] WARNING: Could not find post_install block');
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withModularHeadersFix;
