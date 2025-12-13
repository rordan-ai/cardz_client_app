package com.mycardz.app

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/**
 * Activity ייעודי ל-NFC כדי למנוע התנגשות עם expo-router / deep linking ב-MainActivity.
 * תפקידו: לקבל Intent של NFC ולהעביר אותו ל-MainActivity (singleTop) ואז להיסגר.
 */
class NfcDispatchActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val launchIntent = Intent(this, MainActivity::class.java)
    launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)

    // העתקת action/data/type/extras כדי ש-NfcManager יוכל לקרוא את התג דרך Activity intent
    launchIntent.action = intent?.action
    launchIntent.data = intent?.data
    launchIntent.type = intent?.type
    val extras = intent?.extras
    if (extras != null) {
      launchIntent.putExtras(extras)
    }

    startActivity(launchIntent)
    finish()
  }
}


