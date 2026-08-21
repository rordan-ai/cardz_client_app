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

// N1 — רגישות NFC: מסננים אך ורק תגי NDEF (כארדז = NTAG עם Text/URI records).
// הוסרו NfcA/NfcB/NfcF/NfcV/IsoDep/MifareClassic/MifareUltralight — אלה הטכנולוגיות של
// כרטיסי אשראי/EMV/דרכונים/תחבורה/בקרת-גישה, וגרמו לאפליקציה להיפתח בקרבתם (פתיחות-שווא).
// Ndef/NdefFormatable שומרים על אותה קריאה+טווח+רגישות לתגי כארדז, בלי לתפוס תגים זרים.
const NFC_TECH_FILTER_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:xliff="urn:oasis:names:tc:xliff:document:1.2">
    <tech-list>
        <tech>android.nfc.tech.Ndef</tech>
    </tech-list>
    <tech-list>
        <tech>android.nfc.tech.NdefFormatable</tech>
    </tech-list>
</resources>
`;

const NFC_DISPATCH_ACTIVITY_KT = `package com.yuladigital.cardz

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.nfc.NdefMessage
import android.nfc.NfcAdapter
import android.os.Bundle
import android.util.Log

/**
 * Activity ייעודי ל-NFC - מקבל NFC Intent, פוענח תג, ושולח deep link ל-MainActivity
 */
class NfcDispatchActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    Log.d("NfcDispatch", "=== NFC ACTIVITY STARTED ===")
    Log.d("NfcDispatch", "Intent action: \${intent?.action}")
    Log.d("NfcDispatch", "Intent data: \${intent?.data}")
    Log.d("NfcDispatch", "Intent type: \${intent?.type}")

    val launchIntent = Intent(this, MainActivity::class.java)
    launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)

    // פענוח business code מה-NFC tag
    val businessCode = extractBusinessCodeFromIntent(intent)
    Log.d("NfcDispatch", "Extracted business code: \$businessCode")
    
    if (businessCode != null) {
      // תג כארדז תקין → שליחת deep link שה-Linking listener יתפוס, ופתיחת האפליקציה.
      val deepLinkUri = Uri.parse("mycardz://business/\$businessCode")
      launchIntent.data = deepLinkUri
      Log.d("NfcDispatch", "✓ Sending deep link: \$deepLinkUri")
      startActivity(launchIntent)
    } else {
      // N1: אין business code (תג לא-כארדז / NDEF זר) → לא פותחים את האפליקציה כלל.
      // (בעבר הועבר intent גולמי ל-MainActivity, מה שפתח את האפליקציה גם לתגים זרים.)
      Log.w("NfcDispatch", "✗ Not a Cardz tag (no business code) — ignoring, app not launched")
    }
    finish()
  }

  private fun extractBusinessCodeFromIntent(intent: Intent?): String? {
    if (intent == null) return null

    try {
      val rawMessages = intent.getParcelableArrayExtra(NfcAdapter.EXTRA_NDEF_MESSAGES)
      
      if (rawMessages != null && rawMessages.isNotEmpty()) {
        val ndefMessage = rawMessages[0] as? NdefMessage
        if (ndefMessage != null && ndefMessage.records.isNotEmpty()) {
          val record = ndefMessage.records[0]
          val payload = record.payload
          
          if (payload.isEmpty()) return null
          
          val tnf = record.tnf
          val type = record.type
          
          // URI Record
          if (tnf == 3.toShort() || (tnf == 1.toShort() && type.isNotEmpty() && type[0] == 0x55.toByte())) {
            val uri = parseUriRecord(payload)
            return extractBusinessCodeFromUri(uri)
          }
          
          // Text Record
          if (tnf == 1.toShort()) {
            val text = parseTextRecord(payload)
            if (text.startsWith("mycardz://business/")) {
              return text.substringAfter("mycardz://business/")
            }
            return text
          }
        }
      }
    } catch (e: Exception) {
      Log.e("NfcDispatch", "Error parsing NFC intent", e)
    }
    
    return null
  }

  private fun parseUriRecord(payload: ByteArray): String {
    if (payload.isEmpty()) return ""
    
    val prefixCode = payload[0].toInt()
    val uriBytes = payload.sliceArray(1 until payload.size)
    val uriPath = String(uriBytes, Charsets.UTF_8)
    
    val prefix = when (prefixCode) {
      0x00 -> ""
      0x01 -> "http://www."
      0x02 -> "https://www."
      0x03 -> "http://"
      0x04 -> "https://"
      else -> ""
    }
    
    return prefix + uriPath
  }

  private fun parseTextRecord(payload: ByteArray): String {
    if (payload.isEmpty()) return ""
    
    val langCodeLength = (payload[0].toInt() and 0x3f)
    val textBytes = payload.sliceArray((1 + langCodeLength) until payload.size)
    return String(textBytes, Charsets.UTF_8)
  }

  private fun extractBusinessCodeFromUri(uri: String): String? {
    if (uri.startsWith("mycardz://business/")) {
      return uri.substringAfter("mycardz://business/")
    }
    return null
  }
}
`;

// יצירת קובץ nfc_tech_filter.xml + Activity ייעודי ל-NFC
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

      // כתיבת Activity ייעודי ל-NFC (כדי שהמערכת תפתח את האפליקציה במקום "New tag scanned")
      const ktPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'yuladigital',
        'cardz'
      );
      if (!fs.existsSync(ktPath)) {
        fs.mkdirSync(ktPath, { recursive: true });
      }
      const activityFilePath = path.join(ktPath, 'NfcDispatchActivity.kt');
      if (!fs.existsSync(activityFilePath)) {
        fs.writeFileSync(activityFilePath, NFC_DISPATCH_ACTIVITY_KT);
        console.log('[NFC Plugin] Created NfcDispatchActivity.kt');
      }
      
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

    // הוספת Activity ייעודי ל-NFC (ללא התנגשות עם expo-router ב-MainActivity)
    const hasNfcDispatchActivity = activities.some((a) => a?.$?.['android:name'] === '.NfcDispatchActivity');
    if (!hasNfcDispatchActivity) {
      activities.push({
        $: {
          'android:name': '.NfcDispatchActivity',
          'android:exported': 'true',
          'android:launchMode': 'singleTask',
          'android:noHistory': 'true',
          'android:theme': '@style/Theme.App.SplashScreen',
        },
        'intent-filter': [
          // 1) NDEF_DISCOVERED לטקסט רגיל (התגים שלנו הם NDEF text). מטרתנו: לנסות למנוע chooser מול "Tag/New tag scanned".
          {
            $: { 'android:priority': '1000' },
            action: [{ $: { 'android:name': 'android.nfc.action.NDEF_DISCOVERED' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
            data: [{ $: { 'android:mimeType': 'text/plain' } }],
          },
          // 2) TECH_DISCOVERED כגיבוי
          {
            $: { 'android:priority': '999' },
            action: [{ $: { 'android:name': 'android.nfc.action.TECH_DISCOVERED' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.nfc.action.TECH_DISCOVERED',
              'android:resource': '@xml/nfc_tech_filter',
            },
          },
        ],
      });
      // חשוב: להחזיר את המערך לאחר push (manifest object מוחזק לפי הפניה אבל נשמור עקביות)
      mainApplication.activity = activities;
      console.log('[NFC Plugin] Added NfcDispatchActivity');
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
