// Config plugin to fix Android manifest merger conflict between expo-notifications and firebase-messaging
const { withAndroidManifest } = require('@expo/config-plugins');

function withAndroidManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    
    if (application && application['meta-data']) {
      // Find the notification color meta-data and add tools:replace
      for (const metaData of application['meta-data']) {
        if (metaData.$['android:name'] === 'com.google.firebase.messaging.default_notification_color') {
          metaData.$['tools:replace'] = 'android:resource';
          console.log('[android-manifest-fix] Added tools:replace to notification_color meta-data');
        }
      }
    }
    
    // Ensure tools namespace is declared
    if (!manifest.manifest.$['xmlns:tools']) {
      manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
      console.log('[android-manifest-fix] Added tools namespace');
    }
    
    return config;
  });
}

module.exports = withAndroidManifestFix;

