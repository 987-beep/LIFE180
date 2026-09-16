package com.lostdeviceguard.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager

/**
 * - After REBOOT: re-lock if lost-mode + restart polling + SIM-change check.
 * - After UNLOCK (USER_PRESENT): re-show owner-PIN gate if still lost-mode.
 * - SIM guard: if the SIM fingerprint changed since setup, auto-lock the phone
 *   and raise a SIM_CHANGED alert on the website (thief swapped the SIM!).
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val app = context.applicationContext
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED -> {
                if (Prefs.isLostMode(app) && CommandExecutor.isAdmin(app)) {
                    try {
                        app.startActivity(
                            Intent(app, LockActivity::class.java)
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                        )
                    } catch (_: Exception) {}
                    try { CommandExecutor.dpm(app).lockNow() } catch (_: Exception) {}
                }
                // SIM-change guard (runs on every boot)
                Thread { checkSim(app) }.start()
                try { GuardService.start(app) } catch (_: Exception) {}
            }
            Intent.ACTION_USER_PRESENT -> {
                if (Prefs.isLostMode(app)) {
                    try {
                        app.startActivity(
                            Intent(app, LockActivity::class.java)
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                        )
                    } catch (_: Exception) {}
                }
            }
        }
    }

    companion object {
        /** Current SIM fingerprint (MCC+MNC + operator name — no permission needed). */
        fun simFingerprint(ctx: Context): String {
            return try {
                val tm = ctx.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
                val op = tm.simOperator ?: ""
                val name = tm.simOperatorName ?: ""
                if (op.isEmpty()) "" else "$op|$name"
            } catch (_: Exception) { "" }
        }

        fun checkSim(ctx: Context) {
            try {
                val baseline = Prefs.get(ctx, "sim_baseline", "")
                val current = simFingerprint(ctx)
                if (baseline.isEmpty() || current.isEmpty() || baseline == current) return
                // SIM SWAPPED! Alert once per new SIM.
                if (Prefs.get(ctx, "sim_alerted_for", "") == current) return
                Prefs.set(ctx, "sim_alerted_for", current)
                Prefs.setLostMode(ctx, true)
                if (CommandExecutor.isAdmin(ctx)) {
                    try {
                        ctx.startActivity(
                            Intent(ctx, LockActivity::class.java)
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                        )
                    } catch (_: Exception) {}
                    try { CommandExecutor.dpm(ctx).lockNow() } catch (_: Exception) {}
                }
                Thread {
                    try {
                        val photoId = SpyCamera.snapAndUpload(ctx, true, "intruder selfie on SIM change")
                        Api.alert(
                            ctx, "SIM_CHANGED",
                            "SIM swapped! Was [$baseline] now [$current]. Phone auto-locked.",
                            photoId ?: ""
                        )
                    } catch (_: Exception) {}
                }.start()
            } catch (_: Exception) {}
        }
    }
}
