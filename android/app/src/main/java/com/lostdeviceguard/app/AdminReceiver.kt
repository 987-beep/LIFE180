package com.lostdeviceguard.app

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast

/** Device Admin receiver — this is what grants the app lock/wipe power. */
class AdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Toast.makeText(context, "✅ Device Admin enabled — remote lock is armed", Toast.LENGTH_LONG).show()
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Toast.makeText(context, "⚠️ Device Admin disabled — remote lock will NOT work", Toast.LENGTH_LONG).show()
    }
}
