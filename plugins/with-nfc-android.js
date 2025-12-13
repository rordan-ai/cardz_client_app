const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * פלאגין שמגדיר NFC באנדרואיד בצורה שלא מתנגשת עם expo-router
 * 
 * הגישה:
 * 1. הוספת launchMode="singleTop" - הכרחי לקבלת NFC intents
 * 2. יצירת nfc_tech_filter.xml - מגדיר אילו טכנולוגיות NFC לתפוס
 * 3. הוספת meta-data לטכנולוגיות NFC
 * 
 * לא מוסיפים intent-filter ישירות כי זה מתנגש עם expo-router deep linking
 * במקום זאת, משתמשים ב-Reader Mode (Foreground Dispatch) מהקוד
 */

const NFC_TECH_FILTER_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:xliff="urn:oasis:names:tc:xliff:document:1.2">
    <tech-list>
        <tech>android.nfc.tech.Ndef</tech>
    </tech-list>
    <tech-list>
        <tech>android.nfc.tech.NdefFormatable</tech>
    </tech-list>
    <tech-list>
        <tech>android.nfc.tech.NfcA</tech>
    </tech-list>
    <tech-list>
        <tech>android.nfc.tech.NfcB</tech>
    </tech-list>
    <tech-list>
        <tech>android.nfc.tech.NfcF</tech>
    </tech-list>
    <tech-list>
        <tech>android.nfc.tech.NfcV</tech>
    </tech-list>
    <tech-list>
        <tech>android.nfc.tech.IsoDep</tech>
    </tech-list>
    <tech-list>
        <tech>android.nfc.tech.MifareClassic</tech>
    </tech-list>
    <tech-list>
        <tech>android.nfc.tech.MifareUltralight</tech>
    </tech-list>
</resources>
`;

// יצירת קובץ nfc_tech_filter.xml
function withNfcTechFilter(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const resPath = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      
      // יצירת תיקיית xml אם לא קיימת
      if (!fs.existsSync(resPath)) {
        fs.mkdirSync(resPath, { recursive: true });
      }
      
      // כתיבת קובץ nfc_tech_filter.xml
      const filePath = path.join(resPath, 'nfc_tech_filter.xml');
      fs.writeFileSync(filePath, NFC_TECH_FILTER_XML);
      console.log('[NFC Plugin] Created nfc_tech_filter.xml');
      
      return config;
    },
  ]);
}

// עדכון AndroidManifest.xml
function withNfcManifest(config) {
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
    
    // הוספת launchMode="singleTop" - הכרחי לקבלת NFC intents!
    mainActivity.$['android:launchMode'] = 'singleTop';
    console.log('[NFC Plugin] Set launchMode to singleTop');
    
    // הוספת meta-data עבור nfc_tech_filter (ללא intent-filter!)
    if (!mainActivity['meta-data']) {
      mainActivity['meta-data'] = [];
    }
    
    // בדיקה אם כבר קיים
    const hasNfcTechMeta = mainActivity['meta-data'].some(
      meta => meta.$['android:name'] === 'android.nfc.action.TECH_DISCOVERED'
    );
    
    if (!hasNfcTechMeta) {
      mainActivity['meta-data'].push({
        $: {
          'android:name': 'android.nfc.action.TECH_DISCOVERED',
          'android:resource': '@xml/nfc_tech_filter'
        }
      });
      console.log('[NFC Plugin] Added TECH_DISCOVERED meta-data');
    }
    
    return config;
  });
}

// פלאגין ראשי שמחבר את שני הפלאגינים
function withNfcAndroid(config) {
  config = withNfcTechFilter(config);
  config = withNfcManifest(config);
  return config;
}

module.exports = withNfcAndroid;
