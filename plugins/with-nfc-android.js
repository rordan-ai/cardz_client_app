const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * פלאגין שמוסיף Intent Filters ל-NFC באנדרואיד
 * זה הכרחי כדי שהאפליקציה תתפוס את אירועי ה-NFC במקום מערכת האנדרואיד
 */
function withNfcAndroid(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    
    // מציאת ה-Activity הראשי
    const mainApplication = manifest.manifest.application[0];
    const activities = mainApplication.activity || [];
    
    // חיפוש ה-Activity עם intent-filter של LAUNCHER
    let mainActivity = null;
    for (const activity of activities) {
      const intentFilters = activity['intent-filter'] || [];
      for (const filter of intentFilters) {
        const categories = filter.category || [];
        for (const category of categories) {
          if (category.$['android:name'] === 'android.intent.category.LAUNCHER') {
            mainActivity = activity;
            break;
          }
        }
        if (mainActivity) break;
      }
      if (mainActivity) break;
    }
    
    if (!mainActivity) {
      console.warn('[NFC Plugin] Could not find main activity');
      return config;
    }
    
    console.log('[NFC Plugin] Found main activity:', mainActivity.$['android:name']);
    
    // הוספת launchMode="singleTop" - חשוב ל-NFC!
    mainActivity.$['android:launchMode'] = 'singleTop';
    console.log('[NFC Plugin] Set launchMode to singleTop');
    
    // הוספת Intent Filters ל-NFC
    if (!mainActivity['intent-filter']) {
      mainActivity['intent-filter'] = [];
    }
    
    // NDEF_DISCOVERED - לתגים עם תוכן NDEF
    mainActivity['intent-filter'].push({
      action: [{ $: { 'android:name': 'android.nfc.action.NDEF_DISCOVERED' } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      data: [{ $: { 'android:mimeType': '*/*' } }],
    });
    console.log('[NFC Plugin] Added NDEF_DISCOVERED intent filter');
    
    // TECH_DISCOVERED - לכל סוגי התגים
    mainActivity['intent-filter'].push({
      action: [{ $: { 'android:name': 'android.nfc.action.TECH_DISCOVERED' } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
    });
    console.log('[NFC Plugin] Added TECH_DISCOVERED intent filter');
    
    // TAG_DISCOVERED - fallback לכל תג
    mainActivity['intent-filter'].push({
      action: [{ $: { 'android:name': 'android.nfc.action.TAG_DISCOVERED' } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
    });
    console.log('[NFC Plugin] Added TAG_DISCOVERED intent filter');
    
    // הוספת meta-data עבור tech-list (אופציונלי אבל מומלץ)
    if (!mainActivity['meta-data']) {
      mainActivity['meta-data'] = [];
    }
    
    return config;
  });
}

module.exports = withNfcAndroid;


