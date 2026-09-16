package com.lostdeviceguard.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager

/**
 * 📲 Intercepts incoming/missed calls on the lost phone and forwards metadata
 * to the website so the owner knows who is trying to contact the phone or who is calling the thief.
 */
class CallStateReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return
        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER) ?: "Private/Unknown"
        val app = context.applicationContext

        if (state == TelephonyManager.EXTRA_STATE_RINGING) {
            Thread {
                try {
                    // Upload call notification to website
                    Api.forwardCall(app, incomingNumber, "RINGING")
                    Api.alert(app, "CALL_FORWARDED", "📞 Incoming call from: $incomingNumber")
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }.start()
        }
    }
}
