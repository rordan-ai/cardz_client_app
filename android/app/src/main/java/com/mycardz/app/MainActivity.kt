package com.mycardz.app
import expo.modules.splashscreen.SplashScreenManager

import android.os.Build
import android.os.Bundle
import android.content.Intent
import android.net.Uri
import android.nfc.NdefMessage
import android.nfc.NfcAdapter
import android.util.Log

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    
    Log.d("MainActivity", "=== onCreate ===")
    Log.d("MainActivity", "Intent action: ${intent?.action}")
    Log.d("MainActivity", "Intent data: ${intent?.data}")
    Log.d("MainActivity", "Intent extras: ${intent?.extras?.keySet()?.joinToString()}")
    
    // טיפול ב-NFC Intent שמגיע עם AAR (Android Application Record)
    val nfcDeepLink = processNfcIntent(intent)
    if (nfcDeepLink != null) {
      Log.d("MainActivity", "✓ NFC deep link created: $nfcDeepLink")
      intent.data = Uri.parse(nfcDeepLink)
    } else {
      Log.d("MainActivity", "✗ No NFC deep link extracted")
    }
    
    Log.d("MainActivity", "Final intent.data: ${intent?.data}")
    
    super.onCreate(null)
  }

  override fun onNewIntent(intent: Intent) {
    // טיפול ב-NFC Intent כשהאפליקציה כבר פתוחה
    val nfcDeepLink = processNfcIntent(intent)
    if (nfcDeepLink != null) {
      Log.d("MainActivity", "NFC onNewIntent deep link: $nfcDeepLink")
      intent.data = Uri.parse(nfcDeepLink)
    }
    
    super.onNewIntent(intent)
    // חשוב כדי ש-modules (כמו NFC / deep linking) יראו את ה-intent החדש
    setIntent(intent)
  }
  
  /**
   * פענוח NFC Intent והמרה ל-deep link
   * תומך ב-URI Records וב-Text Records
   */
  private fun processNfcIntent(intent: Intent?): String? {
    if (intent == null) return null
    
    val action = intent.action
    Log.d("MainActivity", "Processing intent action: $action")
    
    // ננסה לקרוא NDEF messages גם אם ה-action הוא MAIN (קורה כש-AAR פותח את האפליקציה)
    // לא נחסום לפי action - רק נבדוק אם יש NDEF data
    
    try {
      val rawMessages = intent.getParcelableArrayExtra(NfcAdapter.EXTRA_NDEF_MESSAGES)
      if (rawMessages == null || rawMessages.isEmpty()) {
        Log.d("MainActivity", "No NDEF messages found")
        return null
      }
      
      val ndefMessage = rawMessages[0] as? NdefMessage
      if (ndefMessage == null || ndefMessage.records.isEmpty()) {
        Log.d("MainActivity", "Empty NDEF message")
        return null
      }
      
      val record = ndefMessage.records[0]
      val payload = record.payload
      if (payload.isEmpty()) {
        Log.d("MainActivity", "Empty payload")
        return null
      }
      
      val tnf = record.tnf
      val type = record.type
      
      Log.d("MainActivity", "Record TNF: $tnf, Type: ${type?.let { String(it) }}")
      
      // URI Record (TNF=3 Absolute URI או TNF=1 עם type="U")
      if (tnf.toInt() == 3 || (tnf.toInt() == 1 && type.isNotEmpty() && type[0] == 0x55.toByte())) {
        val uri = parseUriRecord(payload)
        Log.d("MainActivity", "Parsed URI: $uri")
        if (uri.startsWith("mycardz://business/")) {
          return uri
        }
        return null
      }
      
      // Text Record (TNF=1 עם type="T")
      if (tnf.toInt() == 1 && type.isNotEmpty() && type[0] == 0x54.toByte()) {
        val text = parseTextRecord(payload)
        Log.d("MainActivity", "Parsed Text: $text")
        if (text.startsWith("mycardz://business/")) {
          return text
        }
        // אם זה רק business code (למשל "0002")
        if (text.matches(Regex("^\\d{4}$"))) {
          return "mycardz://business/$text"
        }
        return null
      }
      
      // Fallback - ניסיון לקרוא כטקסט
      val text = parseTextRecord(payload)
      Log.d("MainActivity", "Fallback text: $text")
      if (text.startsWith("mycardz://business/")) {
        return text
      }
      if (text.matches(Regex("^\\d{4}$"))) {
        return "mycardz://business/$text"
      }
      
    } catch (e: Exception) {
      Log.e("MainActivity", "Error processing NFC intent", e)
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
    if (1 + langCodeLength >= payload.size) return ""
    
    val textBytes = payload.sliceArray((1 + langCodeLength) until payload.size)
    return String(textBytes, Charsets.UTF_8)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
