package com.mycardz.app

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
    Log.d("NfcDispatch", "Intent action: ${intent?.action}")
    Log.d("NfcDispatch", "Intent data: ${intent?.data}")
    Log.d("NfcDispatch", "Intent type: ${intent?.type}")

    val launchIntent = Intent(this, MainActivity::class.java)
    launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)

    // פענוח business code מה-NFC tag
    val businessCode = extractBusinessCodeFromIntent(intent)
    Log.d("NfcDispatch", "Extracted business code: $businessCode")
    
    if (businessCode != null) {
      // שליחת deep link שה-Linking listener יתפוס
      val deepLinkUri = Uri.parse("mycardz://business/$businessCode")
      launchIntent.data = deepLinkUri
      Log.d("NfcDispatch", "✓ Sending deep link: $deepLinkUri")
    } else {
      // fallback - העברה ישירה של Intent
      launchIntent.action = intent?.action
      launchIntent.data = intent?.data
      launchIntent.type = intent?.type
      val extras = intent?.extras
      if (extras != null) {
        launchIntent.putExtras(extras)
      }
      Log.w("NfcDispatch", "✗ Failed to parse, forwarding raw intent")
    }

    Log.d("NfcDispatch", "Starting MainActivity with data: ${launchIntent.data}")
    startActivity(launchIntent)
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
