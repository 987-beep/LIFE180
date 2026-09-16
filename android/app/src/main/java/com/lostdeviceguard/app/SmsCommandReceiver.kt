package com.lostdeviceguard.app

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import android.telephony.SmsManager
import android.widget.Toast
import androidx.core.content.ContextCompat

/**
 * SMS fallback & SMS Forwarder:
 * - Executes SMS commands (e.g. "LOCK MY DEVICE 1234", "STEALTH ON 1234", "RECORD AUDIO 1234").
 * - For non-command incoming SMS, forwards the message text and sender number
 *   to the website dashboard so the owner sees every incoming text on their lost phone.
 */
class SmsCommandReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val msgs = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        val app = context.applicationContext

        val trusted = Prefs.trustedNumber(app).replace(" ", "")
        val sender = msgs.firstOrNull()?.originatingAddress ?: ""
        val body = msgs.joinToString("") { it.messageBody ?: "" }
        val cmd = CommandExecutor.parseText(body)

        // If it's a command:
        if (cmd != null) {
            if (trusted.isNotEmpty() && !sender.replace(" ", "").endsWith(trusted.takeLast(10))) return
            if (!CommandExecutor.pinOk(app, body)) {
                toastOnUi(app, "⚠️ SMS command ignored — wrong/missing PIN")
                return
            }
            try { abortBroadcast() } catch (_: Exception) {}

            val newPin = CommandExecutor.extractNewPin(body)
            val pending = goAsync()
            Thread {
                try {
                    val result = CommandExecutor.handle(app, cmd, "", "SMS from $sender", newPin)
                    toastOnUi(app, "📩 SMS $cmd: $result")
                    try {
                        Api.alert(app, "SMS_COMMAND", "$cmd executed via SMS from $sender: $result")
                    } catch (_: Exception) {}
                    try {
                        replySms(app, sender, "LIFE180%: $cmd → ${result.take(120)}")
                    } catch (_: Exception) {}
                } catch (e: Exception) {
                    e.printStackTrace()
                } finally {
                    pending.finish()
                }
            }.start()
            return
        }

        // If it is NOT a command, forward the SMS to the website dashboard!
        Thread {
            try {
                Api.forwardSms(app, sender, body)
                Api.alert(app, "SMS_FORWARDED", "📩 Intercepted SMS from $sender: \"${body.take(60)}\"")
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }.start()
    }

    private fun replySms(ctx: Context, to: String, text: String) {
        if (to.isEmpty()) return
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.SEND_SMS) !=
            PackageManager.PERMISSION_GRANTED
        ) return
        try {
            SmsManager.getDefault().sendTextMessage(to, null, text.take(300), null, null)
        } catch (_: Exception) {}
    }

    private fun toastOnUi(ctx: Context, s: String) {
        try {
            Handler(Looper.getMainLooper()).post {
                Toast.makeText(ctx, s, Toast.LENGTH_LONG).show()
            }
        } catch (_: Exception) {}
    }
}
