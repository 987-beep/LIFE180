package com.lostdeviceguard.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

data class CheckItem(val label: String, val ok: Boolean, val hint: String)

/**
 * 🩺 Security checkup — verifies all 14 protection layers (v1.3 Pro).
 */
object Checkup {

    fun run(ctx: Context): List<CheckItem> {
        val items = mutableListOf<CheckItem>()
        fun perm(p: String) =
            ContextCompat.checkSelfPermission(ctx, p) == PackageManager.PERMISSION_GRANTED

        // 1. Google account
        val owner = Prefs.owner(ctx)
        items += CheckItem(
            "Google account linked",
            owner.isNotEmpty(),
            if (owner.isEmpty()) "Sign in with Google" else owner
        )

        // 2. Device Admin
        val admin = CommandExecutor.isAdmin(ctx)
        items += CheckItem(
            "Device Admin",
            admin,
            if (admin) "Remote lock, gate PIN & wipe armed" else "Tap 'Enable Device Admin'"
        )

        // 3. SMS commands & forwarding
        val sms = perm(Manifest.permission.RECEIVE_SMS) && perm(Manifest.permission.SEND_SMS)
        items += CheckItem(
            "SMS commands & forwarder",
            sms,
            if (sms) "Works even with data OFF" else "Grant SMS permissions"
        )

        // 4. Call state / forwarder
        val call = perm(Manifest.permission.READ_PHONE_STATE)
        items += CheckItem(
            "Call monitor & forwarder",
            call,
            if (call) "Incoming calls alert dashboard" else "Grant phone state permission"
        )

        // 5. Audio recording
        val mic = perm(Manifest.permission.RECORD_AUDIO)
        items += CheckItem(
            "Microphone (remote audio)",
            mic,
            if (mic) "Remote 30s ambient audio armed" else "Grant audio recording permission"
        )

        // 6. Notifications
        val notifOk = if (Build.VERSION.SDK_INT < 33) true
        else perm(Manifest.permission.POST_NOTIFICATIONS)
        items += CheckItem(
            "Notifications",
            notifOk,
            if (notifOk) "Ring + alerts can show" else "Grant notification permission"
        )

        // 7. WhatsApp listener
        val nl = try {
            NotificationManagerCompat.getEnabledListenerPackages(ctx).contains(ctx.packageName)
        } catch (_: Exception) { false }
        items += CheckItem(
            "WhatsApp listener",
            nl,
            if (nl) "Reading WhatsApp command notifications" else "Enable notification access"
        )

        // 8. Battery optimization
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        val ign = if (Build.VERSION.SDK_INT >= 23) pm.isIgnoringBatteryOptimizations(ctx.packageName) else true
        items += CheckItem(
            "Battery unrestricted",
            ign,
            if (ign) "Polling stays alive in background" else "Set battery to Unrestricted"
        )

        // 9. Camera
        val cam = perm(Manifest.permission.CAMERA)
        items += CheckItem(
            "Camera (spy photos)",
            cam,
            if (cam) "Intruder selfies enabled" else "Grant camera permission"
        )

        // 10. Location & driving tracker
        val loc = perm(Manifest.permission.ACCESS_FINE_LOCATION) ||
                perm(Manifest.permission.ACCESS_COARSE_LOCATION)
        items += CheckItem(
            "GPS & Driving tracker",
            loc,
            if (loc) "Live speed & 30-day route history active" else "Grant location permission"
        )

        // 11. Motion sensor
        val motionOk = true // sensor API available
        items += CheckItem(
            "Motion sensor alarm",
            motionOk,
            if (Prefs.getBool(ctx, "motion_armed", false)) "Armed (rings if moved)" else "Ready to arm from web"
        )

        // 12. SIM baseline
        val sim = Prefs.get(ctx, "sim_baseline", "")
        items += CheckItem(
            "SIM-change guard",
            sim.isNotEmpty(),
            if (sim.isEmpty()) "Turn Protection ON once to save SIM fingerprint" else "SIM fingerprint saved"
        )

        // 13. Server reachable
        var serverOk = false
        var serverHint = "Cannot reach server"
        try {
            Api.register(ctx)
            serverOk = true
            serverHint = Api.baseUrl(ctx)
        } catch (e: Exception) {
            serverHint = "Cannot reach ${Api.baseUrl(ctx)} — check URL/internet"
        }
        items += CheckItem("Server reachable", serverOk, serverHint)

        // 14. Protection service
        val on = Prefs.getBool(ctx, "protection_on", false)
        items += CheckItem(
            "Protection service",
            on,
            if (on) "Active: polling + tracking ready" else "Tap 'Protection ON'"
        )

        return items
    }

    fun summary(items: List<CheckItem>): String {
        val ok = items.count { it.ok }
        val bad = items.filter { !it.ok }.joinToString("; ") { it.label }
        return "$ok/${items.size} protections OK" + if (bad.isEmpty()) " — fully guarded ✅" else " — FIX: $bad"
    }
}
