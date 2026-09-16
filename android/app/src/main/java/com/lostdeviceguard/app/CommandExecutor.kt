package com.lostdeviceguard.app

import android.annotation.SuppressLint
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.Toast

/**
 * Executes remote commands from ANY source: website, SMS, or WhatsApp.
 * Supports:
 * - LOCK (with new PIN + gate PIN)
 * - UNLOCK
 * - RECORD_AUDIO (ambient microphone recording)
 * - START_LIVE_TRACK & STOP_LIVE_TRACK (30s GPS pings for 1 hr)
 * - STEALTH_ON & STEALTH_OFF (hide/unhide app launcher)
 * - MOTION_ARM & MOTION_DISARM (motion sensor alarm)
 * - RING / STOP_RING (siren + vibration + strobe)
 * - LOCATE (GPS + speed + battery)
 * - FRONT_PHOTO / BACK_PHOTO (intruder camera)
 * - SHUTDOWN / WIPE / CHECK_STATUS
 */
object CommandExecutor {

    fun dpm(ctx: Context): DevicePolicyManager =
        ctx.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

    fun adminComponent(ctx: Context): ComponentName =
        ComponentName(ctx, AdminReceiver::class.java)

    fun isAdmin(ctx: Context): Boolean = dpm(ctx).isAdminActive(adminComponent(ctx))

    fun handle(
        ctx: Context,
        type: String,
        message: String = "",
        source: String = "web",
        newPin: String = ""
    ): String {
        return when (type.uppercase().trim()) {
            "LOCK" -> doLock(ctx, message, source, newPin)
            "UNLOCK" -> doUnlock(ctx)
            "RING" -> doRing(ctx)
            "STOP_RING" -> doStopRing(ctx)
            "SHUTDOWN" -> doShutdown(ctx)
            "LOCATE" -> doLocate(ctx)
            "RECORD_AUDIO" -> doRecordAudio(ctx, source)
            "START_LIVE_TRACK" -> doStartLiveTrack(ctx)
            "STOP_LIVE_TRACK" -> doStopLiveTrack(ctx)
            "STEALTH_ON" -> doStealth(ctx, true)
            "STEALTH_OFF" -> doStealth(ctx, false)
            "MOTION_ARM" -> doMotion(ctx, true)
            "MOTION_DISARM" -> doMotion(ctx, false)
            "WIPE" -> doWipe(ctx)
            "FRONT_PHOTO" -> doPhoto(ctx, front = true, source)
            "BACK_PHOTO" -> doPhoto(ctx, front = false, source)
            "CHECK_STATUS" -> doCheckup(ctx)
            else -> "unknown command: $type"
        }
    }

    /** Parse free-text (SMS / WhatsApp) into a command type, or null. */
    fun parseText(text: String): String? {
        val t = text.uppercase()
        return when {
            "RECORD AUDIO" in t || "AUDIO MY DEVICE" in t || "MIC MY PHONE" in t -> "RECORD_AUDIO"
            "START LIVE TRACK" in t || "LIVE TRACK" in t || "TRACK MY PHONE" in t -> "START_LIVE_TRACK"
            "STOP LIVE TRACK" in t || "STOP TRACK" in t -> "STOP_LIVE_TRACK"
            "STEALTH ON" in t || "HIDE APP" in t || "HIDE ICON" in t -> "STEALTH_ON"
            "STEALTH OFF" in t || "UNHIDE APP" in t || "SHOW ICON" in t -> "STEALTH_OFF"
            "ARM MOTION" in t || "MOTION ON" in t || "MOTION ARM" in t -> "MOTION_ARM"
            "DISARM MOTION" in t || "MOTION OFF" in t -> "MOTION_DISARM"
            "SHUTDOWN MY DEVICE" in t || "SWITCH OFF MY PHONE" in t || "POWER OFF MY PHONE" in t -> "SHUTDOWN"
            "LOCK MY DEVICE" in t || "LOCK MY PHONE" in t -> "LOCK"
            "UNLOCK MY DEVICE" in t || "UNLOCK MY PHONE" in t -> "UNLOCK"
            "RING MY DEVICE" in t || "RING MY PHONE" in t || "FIND MY PHONE" in t -> "RING"
            "STOP RING" in t -> "STOP_RING"
            "BACK PHOTO" in t -> "BACK_PHOTO"
            "TAKE PHOTO" in t || "CLICK PHOTO" in t || "FRONT PHOTO" in t ||
                    "SELFIE" in t || "PHOTO MY DEVICE" in t || "WHO HAS MY PHONE" in t -> "FRONT_PHOTO"
            "WIPE MY DEVICE" in t || "ERASE MY PHONE" in t -> "WIPE"
            "LOCATE MY DEVICE" in t || "WHERE IS MY PHONE" in t -> "LOCATE"
            "CHECK" in t && "DEVICE" in t -> "CHECK_STATUS"
            else -> null
        }
    }

    /** PIN check: if a PIN is set in the app, the message must contain it. */
    fun pinOk(ctx: Context, text: String): Boolean {
        val pin = Prefs.pin(ctx).trim()
        if (pin.isEmpty()) return true
        return pin in text
    }

    /** Extract "NEW PIN 5678" / "NEWPIN5678" from an SMS/WhatsApp text, or "". */
    fun extractNewPin(text: String): String {
        val m = Regex("(?i)NEW\\s?PIN\\s*(\\d{4,8})").find(text)
        return m?.groupValues?.get(1) ?: ""
    }

    // ---------- actions ----------

    private fun doRecordAudio(ctx: Context, source: String): String {
        val app = ctx.applicationContext
        Thread {
            try {
                AudioRecorderHelper.recordAndUpload(app, 30, "Remote audio triggered via $source")
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }.start()
        return "audio recording started (30s) — will appear on dashboard"
    }

    private fun doStartLiveTrack(ctx: Context): String {
        GuardService.startLiveTracking(ctx, 3600_000L) // 1 hour
        return "live tracking activated (GPS every 30s for 1 hr)"
    }

    private fun doStopLiveTrack(ctx: Context): String {
        GuardService.stopLiveTracking(ctx)
        return "live tracking stopped"
    }

    private fun doStealth(ctx: Context, hide: Boolean): String {
        val ok = StealthManager.setStealth(ctx, hide)
        return if (ok) {
            if (hide) "stealth mode ON (app icon hidden from launcher)"
            else "stealth mode OFF (app icon restored)"
        } else "failed to change stealth setting"
    }

    private fun doMotion(ctx: Context, arm: Boolean): String {
        if (arm) {
            GuardService.armMotion(ctx)
            return "motion alarm armed — phone will siren if moved"
        } else {
            GuardService.disarmMotion(ctx)
            return "motion alarm disarmed"
        }
    }

    private fun doLock(ctx: Context, message: String, source: String, newPin: String): String {
        if (!isAdmin(ctx)) return "failed: Device Admin not enabled"
        if (message.isNotBlank()) Prefs.set(ctx, "lock_message", message)
        Prefs.setLostMode(ctx, true)

        var pinNote = ""
        val cleanPin = newPin.trim()
        if (cleanPin.length in 4..16) {
            Prefs.set(ctx, "pin", cleanPin)
            pinNote = " New owner PIN set. " + trySystemPin(ctx, cleanPin)
        }

        // 1) Owner-PIN gate FIRST
        try {
            ctx.startActivity(Intent(ctx, LockActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            })
        } catch (e: Exception) {
            e.printStackTrace()
        }
        // 2) System lock
        try {
            dpm(ctx).lockNow()
        } catch (e: Exception) {
            return "failed: lockNow error ${e.message}"
        }
        // 3) Silent intruder selfie in background
        val app = ctx.applicationContext
        Thread {
            try {
                val id = SpyCamera.snapAndUpload(app, front = true, "intruder selfie on LOCK ($source)")
                if (id != null) Api.alert(app, "WRONG_PIN", "Intruder selfie captured on remote LOCK", id)
            } catch (_: Exception) {}
        }.start()
        try {
            Toast.makeText(ctx, "🔒 Locked by owner ($source)", Toast.LENGTH_LONG).show()
        } catch (_: Exception) {}
        return "locked via $source (+ intruder selfie uploading).$pinNote"
    }

    private fun trySystemPin(ctx: Context, pin: String): String {
        if (!pin.matches(Regex("\\d{4,16}"))) {
            return "Gate PIN active (system PIN needs 4-16 digits)."
        }
        return try {
            @Suppress("DEPRECATION")
            val ok = dpm(ctx).resetPassword(pin, 0)
            if (ok) "System + gate PIN both changed to new PIN. ✅"
            else "Gate PIN changed ✅ (system PIN refused by Android — gate still enforces it)."
        } catch (e: SecurityException) {
            "Gate PIN changed ✅ (system PIN blocked on this Android version — gate still enforces it)."
        } catch (e: Exception) {
            "Gate PIN changed ✅ (system PIN: ${e.message})."
        }
    }

    private fun doUnlock(ctx: Context): String {
        Prefs.setLostMode(ctx, false)
        return "lost-mode cleared (enter system lock as usual)"
    }

    private fun doRing(ctx: Context): String {
        RingActivity.show(ctx)
        return "ringing loudly"
    }

    private fun doStopRing(ctx: Context): String {
        RingActivity.stop(ctx)
        return "ring stopped"
    }

    private fun doPhoto(ctx: Context, front: Boolean, source: String): String {
        val which = if (front) "front" else "back"
        val id = try {
            SpyCamera.snapAndUpload(ctx, front, "remote $which photo ($source)")
        } catch (e: Exception) {
            return "failed: camera error ${e.message}"
        }
        return if (id != null) "$which photo captured + uploaded — see website gallery"
        else "failed: camera unavailable (grant camera permission / camera in use)"
    }

    private fun doCheckup(ctx: Context): String {
        return try {
            Checkup.summary(Checkup.run(ctx))
        } catch (e: Exception) {
            "checkup failed: ${e.message}"
        }
    }

    private fun doShutdown(ctx: Context): String {
        if (tryRootShutdown()) return "shutdown executed (root)"
        if (isAdmin(ctx)) {
            Prefs.setLostMode(ctx, true)
            try {
                ctx.startActivity(Intent(ctx, LockActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    putExtra("shutdown_mode", true)
                })
            } catch (_: Exception) {}
            try { dpm(ctx).lockNow() } catch (_: Exception) {}
            val app = ctx.applicationContext
            Thread {
                try { SpyCamera.snapAndUpload(app, true, "intruder selfie on SHUTDOWN") } catch (_: Exception) {}
            }.start()
        }
        return "no-root: deep-locked instead. Power-off blocked by gate PIN."
    }

    private fun tryRootShutdown(): Boolean {
        return try {
            val p = Runtime.getRuntime().exec(arrayOf("su", "-c", "reboot -p"))
            p.waitFor()
            p.exitValue() == 0
        } catch (_: Exception) { false }
    }

    @SuppressLint("MissingPermission")
    private fun doLocate(ctx: Context): String {
        return try {
            val loc = LocationTracker.getFreshLocation(ctx, "locate_cmd")
            if (loc != null) {
                val batt = Api.batteryPct(ctx)
                val speedKmh = (loc.speed * 3.6f).toInt()
                "location: ${loc.latitude},${loc.longitude} (±${loc.accuracy.toInt()}m, speed: ${speedKmh}km/h, 🔋${if (batt >= 0) "$batt%" else "?"}) — see website map"
            } else {
                "location unavailable (enable GPS / grant location permission)"
            }
        } catch (e: Exception) {
            "locate failed: ${e.message}"
        }
    }

    private fun doWipe(ctx: Context): String {
        if (!isAdmin(ctx)) return "failed: Device Admin not enabled"
        return try {
            dpm(ctx).wipeData(DevicePolicyManager.WIPE_EXTERNAL_STORAGE)
            "wipe initiated"
        } catch (e: Exception) {
            "wipe failed: ${e.message}"
        }
    }
}
