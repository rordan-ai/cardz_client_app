// Config plugin to force modular headers for Swift pods that require module maps when using static libs.
const { withPodfile } = require('@expo/config-plugins');

module.exports = function withIosModularHeaders(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;

    // Ensure global modular headers
    if (!contents.includes('use_modular_headers!')) {
      contents = contents.replace(/(platform :ios, ['"]\d+\.\d+['"]\n)/, `$1use_modular_headers!\n`);
    }

    const ensureModular = (podName) => {
      const regex = new RegExp(`pod '${podName}'.*`);
      contents = contents.replace(regex, (line) => {
        if (line.includes(':modular_headers => true')) return line;
        return line.replace(/\n?$/, '').replace(/\s+$/, '') + ", :modular_headers => true\n";
      });
    };

    ensureModular('GoogleUtilities');
    ensureModular('FirebaseCoreInternal');

    config.modResults.contents = contents;
    return config;
  });
};

