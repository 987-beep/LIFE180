package com.lostdeviceguard.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.telephony.SmsManager
import androidx.core.content.ContextCompat

/**
 * 🪫 Low-battery & Shutdown emergency broadcaster:
 * - Detects BATTERY_LOW (usually <= 15%) or system ACTION_SHUTDOWN.
 * - Captures the phone's last known GPS coordinate.
 * - Sends an emergency SMS to the trusted number with Google Maps coordinates.
 * - Posts LOW_BATTERY or SHUTDOWN_ATTEMPT alert to the website.
 */
class BatteryReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val app = context.applicationContext

        val isShutdown = action == Intent.ACTION_SHUTDOWN
        val isLowBatt = action == Intent.ACTION_BATTERY_LOW

        if (!isShutdown && !isLowBatt) return

        val trusted = Prefs.trustedNumber(app).trim()
        val batt = Api.batteryPct(app)

        Thread {
            try {
                val loc = getLastLoc(app)
                val latStr = if (loc != null) String.format("%.5f", loc.latitude) else "unavailable"
                val lngStr = if (loc != null) String.format("%.5f", loc.longitude) else "unavailable"
                val mapsUrl = if (loc != null) "https://maps.google.com/?q=${loc.latitude},${loc.longitude}" else ""

                val tag = if (isShutdown) "📵 Phone Powering Off" else "🪫 Critical Battery (${batt}%)"
                val smsBody = "LIFE180% Alert: $tag! Last location: $latStr, $lngStr $mapsUrl".trim()

                // 1. Send SMS to trusted number if set
                if (trusted.isNotEmpty() && ContextCompat.checkSelfPermission(app, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED) {
                    try {
                        SmsManager.getDefault().sendTextMessage(trusted, null, smsBody.take(160), null, null)
                    } catch (_: Exception) {}
                }

                // 2. Post alert to website
                val alertType = if (isShutdown) "SHUTDOWN_ATTEMPT" else "LOW_BATTERY"
                Api.alert(app, alertType, "$tag. Last GPS: $latStr, $lngStr $mapsUrl")

                // 3. Report location
                if (loc != null) {
                    LocationTracker.report(app, loc, if (isShutdown) "shutdown" else "low_batt")
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }.start()
    }

    @SuppressLint("MissingPermission")
    private fun getLastLoc(ctx: Context): android.location.Location? {
        val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
        var best: android.location.Location? = null
        for (p in lm.getProviders(true)) {
            try {
                val l = lm.getLastKnownLocation(p) ?: continue
                if (best == null || l.time > best.time) best = l
            } catch (_: SecurityException) {}
        }
        return best
    }
}
