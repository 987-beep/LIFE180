package com.lostdeviceguard.app

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager

/**
 * 🥷 Stealth Mode:
 * Enables or disables the app launcher icon from the Android home screen/app drawer.
 * When enabled (hidden), the thief cannot see or open Lost Device Guard.
 * The owner can unhide it anytime from the website or via SMS "STEALTH OFF 1234".
 */
object StealthManager {

    fun setStealth(ctx: Context, hide: Boolean): Boolean {
        return try {
            val pm = ctx.packageManager
            val component = ComponentName(ctx, MainActivity::class.java)
            val newState = if (hide) {
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED
            } else {
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            }
            pm.setComponentEnabledSetting(component, newState, PackageManager.DONT_KILL_APP)
            Prefs.setBool(ctx, "stealth_active", hide)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    fun isStealth(ctx: Context): Boolean = Prefs.getBool(ctx, "stealth_active", false)
}
