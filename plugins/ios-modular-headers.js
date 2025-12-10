// Config plugin to fix modular headers issues with Firebase and New Architecture
const { withPodfile } = require('@expo/config-plugins');

module.exports = function withIosModularHeaders(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;

    // 1. הוספת use_modular_headers! גלובלי
    if (!contents.includes('use_modular_headers!')) {
      contents = contents.replace(/(platform :ios, ['"]\d+\.\d+['"]\n)/, `$1use_modular_headers!\n`);
    }

    // 2. פונקציה להוספת modular headers לפוד ספציפי
    const ensureModular = (podName) => {
      const regex = new RegExp(`pod '${podName}'.*`);
      contents = contents.replace(regex, (line) => {
        if (line.includes(':modular_headers => true')) return line;
        return line.replace(/\n?$/, '').replace(/\s+$/, '') + ", :modular_headers => true\n";
      });
    };

    // 3. הוספת modular headers לפודים בעייתיים
    ensureModular('GoogleUtilities');
    ensureModular('FirebaseCoreInternal');
    ensureModular('FirebaseCore');

    // 4. הוספת post_install hook לאפשר non-modular includes - הפתרון העיקרי!
    const postInstallHook = `
  # Fix for Firebase modular headers with New Architecture
  post_install do |installer|
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        # Allow non-modular includes in framework modules - fixes RNFBApp issue
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        
        # Ensure proper header search paths
        config.build_settings['HEADER_SEARCH_PATHS'] ||= '$(inherited)'
      end
    end
    
    # Call react_native_post_install if it exists
    if defined?(react_native_post_install)
      react_native_post_install(installer)
    end
  end
`;

    // הוספת ה-hook רק אם לא קיים כבר
    if (!contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
      // מחפש את סוף הקובץ או לפני end אחרון
      if (contents.includes('post_install do |installer|')) {
        // אם יש כבר post_install, צריך להוסיף לתוכו
        contents = contents.replace(
          /(post_install do \|installer\|.*?)(end\s*$)/s,
          (match, start, end) => {
            // הוספה לפני ה-end
            return start + `
    # Fix for Firebase modular headers with New Architecture
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
` + end;
          }
        );
      } else {
        // אין post_install, מוסיפים חדש לפני ה-end האחרון
        contents = contents.replace(/\nend\s*$/, '\n' + postInstallHook + '\nend\n');
      }
    }

    config.modResults.contents = contents;
    return config;
  });
};
