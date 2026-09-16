package com.lostdeviceguard.app

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * WhatsApp fallback — reads the TEXT of incoming WhatsApp message notifications.
 * Send "LOCK MY DEVICE 1234" / "TAKE PHOTO 1234" to this phone on WhatsApp.
 * Requires: Notification Access + WhatsApp notifications ON + data ON.
 */
class WhatsAppListener : NotificationListenerService() {

    private val targets = setOf("com.whatsapp", "com.whatsapp.w4b" /* Business */)

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in targets) return
        val extras = sbn.notification.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
            ?: return
        if (text.isBlank()) return

        val full = "$title $text"
        val cmd = CommandExecutor.parseText(full) ?: return

        val trusted = Prefs.get(this, "trusted_wa_name", "").trim()
        if (trusted.isNotEmpty() && !title.contains(trusted, ignoreCase = true)) return
        if (!CommandExecutor.pinOk(this, full)) return

        val app = applicationContext
        val newPin = CommandExecutor.extractNewPin(full)
        // Slow commands (camera/GPS) go to a background thread.
        // After executing, sync an activity alert back to the website.
        if (cmd == "FRONT_PHOTO" || cmd == "BACK_PHOTO" || cmd == "LOCATE" || cmd == "CHECK_STATUS") {
            Thread {
                try {
                    val r = CommandExecutor.handle(app, cmd, "", "WhatsApp from $title", newPin)
                    Api.alert(app, "WA_COMMAND", "$cmd executed via WhatsApp from $title: $r")
                } catch (_: Exception) {}
            }.start()
        } else {
            try {
                val r = CommandExecutor.handle(app, cmd, "", "WhatsApp from $title", newPin)
                Thread {
                    try {
                        Api.alert(app, "WA_COMMAND", "$cmd executed via WhatsApp from $title: $r")
                    } catch (_: Exception) {}
                }.start()
            } catch (_: Exception) {}
        }
        // Remove the command message notification so a thief sees nothing
        try { cancelNotification(sbn.key) } catch (_: Exception) {}
    }
}
